/** Only broad categories leave this file. A full user agent or referrer is never stored. */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|discord|preview|embedly|pingdom|uptime|monitor|curl|wget|python-requests|node-fetch|axios|go-http|java\/|libwww/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export type DeviceCategory = "mobile" | "tablet" | "desktop";

export function deviceCategory(userAgent: string): DeviceCategory {
  if (/ipad|tablet|kindle|silk|playbook/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) {
    return "tablet";
  }
  return /mobi|iphone|ipod|android/i.test(userAgent) ? "mobile" : "desktop";
}

export function browserCategory(userAgent: string): string {
  // Order matters: most browsers also claim to be Chrome and Safari.
  if (/edg(e|a|ios)?\//i.test(userAgent)) return "Edge";
  if (/opr\/|opera/i.test(userAgent)) return "Opera";
  if (/samsungbrowser/i.test(userAgent)) return "Samsung Internet";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/chrome|crios|chromium/i.test(userAgent)) return "Chrome";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Other";
}

export function osCategory(userAgent: string): string {
  // iOS and Android come first because their user agents also mention other systems.
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os x|macintosh/i.test(userAgent)) return "macOS";
  if (/linux|cros/i.test(userAgent)) return "Linux";
  return "Other";
}

// Each must end in a real domain ending, so google.evil.example doesn't pass as Google.
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\.(com|net|org|in|co\.[a-z]{2}|com\.[a-z]{2})$/i;
const SOCIAL = /(^|\.)(instagram|facebook|fb|t|x|twitter|linkedin|lnkd|youtube|youtu|tiktok|pinterest|reddit|snapchat|threads|whatsapp|wa|telegram|discord|twitch)\.(com|net|org|me|be|co|in|tv|gg)$/i;
const EMAIL = /^(mail\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.com|mail\.proton\.me)$/i;

export type ReferrerCategory = "direct" | "search" | "social" | "email" | "other";

/** Reduces a referrer to a category. A visit from the app's own pages counts as direct. */
export function referrerCategory(referrer: unknown, ownHost: string | null): ReferrerCategory {
  if (typeof referrer !== "string" || !referrer) return "direct";
  let hostname: string;
  try {
    hostname = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (ownHost && hostname === ownHost.split(":")[0].toLowerCase()) return "direct";
  // Webmail is checked first, because mail.google.com would otherwise look like a search engine.
  if (EMAIL.test(hostname)) return "email";
  if (SEARCH.test(hostname)) return "search";
  if (SOCIAL.test(hostname)) return "social";
  return "other";
}

/** Two letters from the host's geolocation header, or nothing. */
export function countryCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

/** Honours a browser's Global Privacy Control or Do Not Track signal. */
export function hasOptedOut(headers: Pick<Headers, "get">): boolean {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";
}
