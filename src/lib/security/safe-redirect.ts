const DEFAULT_PATH = "/dashboard";
const PLACEHOLDER_ORIGIN = "http://findme.invalid";

/**
 * Returns a same-origin path, or the fallback. Parses with the URL API, the same way a
 * browser will, instead of pattern-matching, so tricks like `//evil.com`, `/\evil.com`,
 * and tabs or newlines inside the scheme cannot slip through.
 */
export function safeRedirectPath(input: unknown, fallback: string = DEFAULT_PATH): string {
  if (typeof input !== "string" || !input.startsWith("/")) return fallback;
  // Browsers treat backslashes as slashes and strip control characters, so reject them outright.
  if (/[\\\u0000-\u001f\u007f]/.test(input)) return fallback;
  // Encoded variants could turn back into the above if decoded again further down the line.
  if (/%(2f|5c|09|0a|0d|00)/i.test(input)) return fallback;

  try {
    const url = new URL(input, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    if (url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
