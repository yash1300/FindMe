import { Buffer } from "node:buffer";
import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { stripImageMetadata } from "./strip-metadata";

const SECRET = "GPS 19.0760 72.8777";
const contains = (bytes: Uint8Array | null, text: string) => Buffer.from(bytes ?? []).includes(text);

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
}

function exif(orientation: number, littleEndian = false): Buffer {
  const directory = Buffer.alloc(14 + 4);
  const write16 = (value: number, at: number) => (littleEndian ? directory.writeUInt16LE(value, at) : directory.writeUInt16BE(value, at));
  const write32 = (value: number, at: number) => (littleEndian ? directory.writeUInt32LE(value, at) : directory.writeUInt32BE(value, at));
  write16(1, 0);
  write16(0x0112, 2);
  write16(3, 4);
  write32(1, 6);
  write16(orientation, 10);
  const header = Buffer.alloc(8);
  header.write(littleEndian ? "II" : "MM", 0, "latin1");
  if (littleEndian) {
    header.writeUInt16LE(42, 2);
    header.writeUInt32LE(8, 4);
  } else {
    header.writeUInt16BE(42, 2);
    header.writeUInt32BE(8, 4);
  }
  return Buffer.concat([Buffer.from("Exif\0\0", "latin1"), header, directory, Buffer.from(SECRET)]);
}

const SCAN = Buffer.concat([jpegSegment(0xda, Buffer.from([1, 2, 3])), Buffer.from([0x11, 0xff, 0x00, 0x22]), Buffer.from([0xff, 0xd9])]);

function jpeg(...segments: Buffer[]): Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments, jpegSegment(0xdb, Buffer.from([9, 9])), SCAN]));
}

describe("stripImageMetadata: JPEG", () => {
  it("removes location data, XMP and comments, but keeps the picture", () => {
    const input = jpeg(jpegSegment(0xe1, exif(1)), jpegSegment(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0${SECRET}`)), jpegSegment(0xfe, Buffer.from(SECRET)));
    const output = stripImageMetadata(input, "jpg");
    expect(contains(input, SECRET)).toBe(true);
    expect(contains(output, SECRET)).toBe(false);
    expect(contains(output, "Exif")).toBe(false);
    expect(Buffer.from(output!).includes(SCAN)).toBe(true);
    expect(Buffer.from(output!).includes(jpegSegment(0xdb, Buffer.from([9, 9])))).toBe(true);
  });

  it.each([false, true])("keeps only the rotation, so portrait photos stay upright (little-endian: %s)", (littleEndian) => {
    const output = stripImageMetadata(jpeg(jpegSegment(0xe1, exif(6, littleEndian))), "jpg")!;
    expect(contains(output, SECRET)).toBe(false);
    const rotated = Buffer.from(output);
    expect(rotated.subarray(2, 4)).toEqual(Buffer.from([0xff, 0xe1]));
    expect(rotated.readUInt16BE(4)).toBe(34);
    expect(rotated.subarray(6, 12).toString("latin1")).toBe("Exif\0\0");
    expect(rotated.readUInt16BE(30)).toBe(6);
  });

  it("keeps the colour profile and the colour marker", () => {
    const icc = jpegSegment(0xe2, Buffer.from("ICC_PROFILE\0profile"));
    const adobe = jpegSegment(0xee, Buffer.from("Adobe"));
    const other = jpegSegment(0xe2, Buffer.from(`MPF\0${SECRET}`));
    const output = Buffer.from(stripImageMetadata(jpeg(icc, adobe, other), "jpg")!);
    expect(output.includes(icc)).toBe(true);
    expect(output.includes(adobe)).toBe(true);
    expect(output.includes(SECRET)).toBe(false);
  });

  it("drops extra images that phones add after the end of the picture", () => {
    const trailer = jpeg(jpegSegment(0xe1, exif(1)));
    const input = new Uint8Array(Buffer.concat([jpeg(), trailer]));
    expect(contains(stripImageMetadata(input, "jpg"), SECRET)).toBe(false);
  });

  it("keeps a picture with no end marker, since nothing can follow it", () => {
    const input = Buffer.concat([Buffer.from([0xff, 0xd8]), jpegSegment(0xe1, exif(1)), jpegSegment(0xda, Buffer.from([1])), Buffer.from([5, 6])]);
    const output = Buffer.from(stripImageMetadata(new Uint8Array(input), "jpg")!);
    expect(output.includes(SECRET)).toBe(false);
    expect(output.subarray(-2)).toEqual(Buffer.from([5, 6]));
  });

  it("refuses a file it can't follow, rather than letting metadata through", () => {
    expect(stripImageMetadata(Uint8Array.from([0xff, 0xd8, 0x00, 0x01, 0x02]), "jpg")).toBeNull();
    expect(stripImageMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]), "jpg")).toBeNull();
    expect(stripImageMetadata(Uint8Array.from([0xff, 0xd8]), "jpg")).toBeNull();
  });
});

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

describe("stripImageMetadata: PNG", () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = pngChunk("IHDR", Buffer.alloc(13, 1));
  const data = pngChunk("IDAT", Buffer.from([1, 2, 3]));
  const end = pngChunk("IEND", Buffer.alloc(0));

  it("removes text and Exif chunks, keeping the rest unchanged", () => {
    const input = new Uint8Array(Buffer.concat([signature, header, pngChunk("eXIf", Buffer.from(SECRET)), pngChunk("tEXt", Buffer.from(SECRET)), pngChunk("iTXt", Buffer.from(SECRET)), data, end, Buffer.from(SECRET)]));
    expect(Buffer.from(stripImageMetadata(input, "png")!)).toEqual(Buffer.concat([signature, header, data, end]));
  });

  it("refuses a chunk that runs past the end of the file", () => {
    const broken = Buffer.concat([signature, Buffer.from([0x7f, 0xff, 0xff, 0xff]), Buffer.from("IDAT"), Buffer.alloc(8)]);
    expect(stripImageMetadata(new Uint8Array(broken), "png")).toBeNull();
  });
});

function webpChunk(type: string, data: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(type, "latin1"), size, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function webp(...chunks: Buffer[]): Uint8Array {
  const body = Buffer.concat([Buffer.from("WEBP"), ...chunks]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  return new Uint8Array(Buffer.concat([Buffer.from("RIFF"), size, body]));
}

describe("stripImageMetadata: WebP", () => {
  it("removes metadata, clears its flags and corrects the file size", () => {
    const flags = Buffer.alloc(10);
    flags[0] = 0b0001_1100;
    const picture = webpChunk("VP8 ", Buffer.from([1, 2, 3]));
    const output = stripImageMetadata(webp(webpChunk("VP8X", flags), picture, webpChunk("EXIF", Buffer.from(SECRET)), webpChunk("XMP ", Buffer.from(SECRET))), "webp")!;
    const result = Buffer.from(output);
    expect(result.includes(SECRET)).toBe(false);
    expect(result.includes(picture)).toBe(true);
    expect(result.readUInt32LE(4)).toBe(result.length - 8);
    expect(result[20]).toBe(0b0001_0000);
  });

  it("refuses a chunk that runs past the end of the file", () => {
    const broken = Buffer.concat([Buffer.from(webp()), Buffer.from("VP8 "), Buffer.from([0xff, 0xff, 0xff, 0x7f])]);
    expect(stripImageMetadata(new Uint8Array(broken), "webp")).toBeNull();
    expect(stripImageMetadata(webp(), "webp")).toBeNull();
  });
});

describe("stripImageMetadata: GIF", () => {
  it("returns the image as it is", () => {
    const gif = new Uint8Array(Buffer.from("GIF89a..."));
    expect(stripImageMetadata(gif, "gif")).toBe(gif);
  });
});
