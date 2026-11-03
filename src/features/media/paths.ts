import { z } from "zod";

export const MEDIA_BUCKET = "profile-media";
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEDIA_PATH = new RegExp(`^${UUID}/${UUID}\\.(png|jpg|webp|gif)$`);

/** `{user id}/{random id}.{ext}`, with nothing a caller could use to escape the bucket. */
export const mediaPathSchema = z.string().regex(MEDIA_PATH, "That image isn't valid.");

export function isMediaPathOwnedBy(path: string, userId: string): boolean {
  return MEDIA_PATH.test(path) && path.startsWith(`${userId}/`);
}

/** The public URL for a stored image, or null for anything that isn't a valid media path. */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path || !MEDIA_PATH.test(path)) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export type SniffedImage = { extension: "png" | "jpg" | "webp" | "gif"; contentType: string };

/** Identifies an image by its first bytes. The browser's claimed type and the file name aren't trusted. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const startsWith = (...values: number[]) => values.every((value, index) => bytes[index] === value);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { extension: "png", contentType: "image/png" };
  }
  if (startsWith(0xff, 0xd8, 0xff)) return { extension: "jpg", contentType: "image/jpeg" };
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return { extension: "gif", contentType: "image/gif" };
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}
