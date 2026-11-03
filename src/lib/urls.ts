import { z } from "zod";

const MAX_URL_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_AND_PORT = /^[^/:]+:\d+(\/|$)/;

/**
 * Returns a normalised http(s) URL, or null. This is used on write and again at render,
 * so a stored value is never trusted just because it was once validated.
 * Bare domains get https:// added, since people commonly paste "example.com".
 */
export function normalizeHttpUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  // Browsers strip these before parsing, which is how "java\tscript:" attacks work.
  if (/[\u0000- \u007f\\]/.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return null;

  const withScheme = HAS_SCHEME.test(trimmed) && !HOST_AND_PORT.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // user:pass@host is a classic way to disguise where a link really goes.
  if (url.username || url.password) return null;
  // Rejects "localhost" and other names that aren't on the public internet.
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  return url.toString();
}

export const httpUrlSchema = z.string().transform((value, context) => {
  const url = normalizeHttpUrl(value);
  if (!url) {
    context.addIssue({ code: "custom", message: "Enter a valid web address, like https://example.com." });
    return z.NEVER;
  }
  return url;
});

export const emailAddressSchema = z.string().trim().pipe(z.email("Enter a valid email address.").max(254));

/** Digits with an optional leading +, so that the value is always safe inside a tel: link. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{5,15}$/, "Enter a valid phone number, like +91 98765 43210."));

export function isSafeMailto(value: string): boolean {
  return /^mailto:[^\s<>"'&?]+@[^\s<>"'&?]+$/i.test(value);
}
