import type { SniffedImage } from "./paths";

/**
 * Removes hidden metadata from an uploaded image before it's made public. Phone photos often
 * carry the GPS position they were taken at, which on a public page could reveal someone's home.
 * The picture itself is never re-encoded, so quality is unchanged.
 *
 * Returns null when the file's structure can't be followed, because then we can't promise
 * the metadata is gone. GIFs are returned as they are: they don't carry location data in practice.
 */
export function stripImageMetadata(bytes: Uint8Array, extension: SniffedImage["extension"]): Uint8Array | null {
  if (extension === "jpg") return stripJpeg(bytes);
  if (extension === "png") return stripPng(bytes);
  if (extension === "webp") return stripWebp(bytes);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** The rotation a camera recorded, which has to survive or portrait photos would appear sideways. */
function readExifOrientation(segment: Uint8Array): number | null {
  // Segment layout: FF E1, 2-byte length, "Exif\0\0", then a TIFF structure.
  if (segment.length < 24 || ascii(segment, 4, 6) !== "Exif\0\0") return null;
  const tiff = 10;
  const order = ascii(segment, tiff, 2);
  if (order !== "II" && order !== "MM") return null;
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  const little = order === "II";

  const firstDirectory = tiff + view.getUint32(tiff + 4, little);
  if (firstDirectory + 2 > segment.length) return null;
  const count = view.getUint16(firstDirectory, little);
  for (let index = 0; index < count; index += 1) {
    const entry = firstDirectory + 2 + index * 12;
    if (entry + 12 > segment.length) return null;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 2 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** A new Exif segment containing the rotation and nothing else. */
function orientationSegment(orientation: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, first directory at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // orientation
    0x00, 0x00, 0x00, 0x00, // no more directories
  ]);
}

function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  const kept: Uint8Array[] = [];
  let orientation: number | null = null;
  let position = 2;

  while (position < bytes.length) {
    if (bytes[position] !== 0xff) return null;
    // Any number of FF bytes may pad a marker.
    while (bytes[position + 1] === 0xff) position += 1;
    const marker = bytes[position + 1];
    if (marker === undefined) return null;

    if (marker === 0xd9) break; // End of image, with no picture data found.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      position += 2;
      continue;
    }
    if (position + 4 > bytes.length) return null;
    const end = position + 2 + ((bytes[position + 2] << 8) | bytes[position + 3]);
    if (end > bytes.length) return null;
    const segment = bytes.subarray(position, end);

    if (marker === 0xda) {
      // Picture data follows. Phones often add more images after the end marker, each with
      // its own metadata, so everything after the first end marker is dropped.
      kept.push(bytes.subarray(position, endOfImage(bytes, end)));
      const head = orientation ? [orientationSegment(orientation)] : [];
      return concat([bytes.subarray(0, 2), ...head, ...kept]);
    }

    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xe1) orientation = readExifOrientation(segment) ?? orientation;
    const keep =
      (!isApp && marker !== 0xfe) || // Not an application segment or a comment: part of the picture.
      marker === 0xe0 || // Basic JFIF header.
      marker === 0xee || // Adobe colour marker, which changes how colours decode.
      (marker === 0xe2 && ascii(segment, 4, 11) === "ICC_PROFILE"); // Colour profile.
    if (keep) kept.push(segment);
    position = end;
  }
  return null;
}

/** Finds where the image ends. Inside picture data, a real FF byte is always followed by 00. */
function endOfImage(bytes: Uint8Array, from: number): number {
  for (let index = from; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) return index + 2;
  }
  return bytes.length;
}

const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(bytes: Uint8Array): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let position = 8;

  while (position + 12 <= bytes.length) {
    const end = position + 12 + view.getUint32(position);
    if (end > bytes.length) return null;
    const type = ascii(bytes, position + 4, 4);
    if (!PNG_METADATA_CHUNKS.has(type)) kept.push(bytes.subarray(position, end));
    if (type === "IEND") return concat(kept);
    position = end;
  }
  return null;
}

function stripWebp(bytes: Uint8Array): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [];
  let position = 12;

  while (position + 8 <= bytes.length) {
    const size = view.getUint32(position + 4, true);
    const end = position + 8 + size + (size % 2);
    if (position + 8 + size > bytes.length) return null;
    const type = ascii(bytes, position, 4);
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = bytes.slice(position, Math.min(end, bytes.length));
      // The extended header has flags announcing metadata, which must now be switched off.
      if (type === "VP8X" && chunk.length > 8) chunk[8] &= ~0b0000_1100;
      kept.push(chunk);
    }
    position = end;
  }
  if (position < bytes.length || kept.length === 0) return null;

  const body = concat(kept);
  const header = bytes.slice(0, 12);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}
