/** Where a request's host belongs. Everything else is treated as a creator's custom domain. */
export function isAppHost(host: string, appUrl: string): boolean {
  const name = host.split(":")[0].toLowerCase();
  if (name === "localhost" || name === "127.0.0.1" || name.endsWith(".vercel.app")) return true;
  try {
    return name === new URL(appUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
}

const HOSTNAME = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
// Addresses that aren't the customer's to claim.
const BLOCKED_SUFFIXES = [".vercel.app", ".vercel.com", ".supabase.co", ".supabase.com", ".localhost", ".local", ".internal", ".test", ".invalid", ".example"];

/** Cleans up what someone typed, or returns null if it can't be a domain they could own. */
export function normalizeHostname(input: unknown, appUrl: string): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (value.length > 253 || !HOSTNAME.test(value)) return null;
  if (BLOCKED_SUFFIXES.some((suffix) => value.endsWith(suffix) || `.${value}` === suffix)) return null;

  let appHost = "";
  try {
    appHost = new URL(appUrl).hostname.toLowerCase();
  } catch {
    // An invalid app URL can't match anything below.
  }
  if (appHost && (value === appHost || value.endsWith(`.${appHost}`))) return null;
  return value;
}

export const VERIFICATION_PREFIX = "_findme";

export function verificationRecordName(hostname: string): string {
  return `${VERIFICATION_PREFIX}.${hostname}`;
}

export function txtRecordsContain(records: string[][], token: string): boolean {
  return records.some((chunks) => chunks.join("") === token);
}
