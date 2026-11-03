"use server";

import { requireProfileOwner } from "@/features/auth/session";
import { limitUser } from "@/features/profile/guard";
import { type ActionResult, failure } from "@/features/profile/result";
import { logger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, sniffImage } from "./paths";

/** Stores an image under the user's own folder, after checking what the file really is. */
export async function uploadMediaAction(formData: FormData): Promise<ActionResult<{ path: string }>> {
  const { user } = await requireProfileOwner();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return failure("Choose an image to upload.");
  if (file.size > MEDIA_MAX_BYTES) return failure("That image is too large. The limit is 5 MB.");

  const limited = await limitUser(user.id, "upload", RATE_LIMITS.uploadByUser);
  if (limited) return limited;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) return failure("Use a PNG, JPEG, WebP or GIF image.");

  const path = `${user.id}/${crypto.randomUUID()}.${image.extension}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    // From the sniffed bytes, never from what the browser claimed.
    contentType: image.contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    logger.error("media.upload_failed", { message: error.message });
    return failure("We couldn't upload that image. Please try again.");
  }
  return { ok: true, path };
}
