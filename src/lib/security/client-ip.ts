/**
 * Best-effort client IP for rate limiting only; never stored or used as identity.
 * Vercel overwrites x-forwarded-for, so the header can be trusted there. On any other
 * host, review this first: a client could otherwise spoof it to dodge IP limits.
 */
export function getClientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
