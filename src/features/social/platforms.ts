import { isSafeMailto, normalizeHttpUrl } from "@/lib/urls";

export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"], placeholder: "https://instagram.com/yourname" },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"], placeholder: "https://tiktok.com/@yourname" },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], placeholder: "https://youtube.com/@yourname" },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], placeholder: "https://facebook.com/yourname" },
  { id: "x", label: "X", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/yourname" },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], placeholder: "https://linkedin.com/in/yourname" },
  { id: "pinterest", label: "Pinterest", hosts: ["pinterest.com", "pinterest.in", "pin.it"], placeholder: "https://pinterest.com/yourname" },
  { id: "snapchat", label: "Snapchat", hosts: ["snapchat.com"], placeholder: "https://snapchat.com/add/yourname" },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv"], placeholder: "https://twitch.tv/yourname" },
  { id: "discord", label: "Discord", hosts: ["discord.gg", "discord.com"], placeholder: "https://discord.gg/invite" },
  { id: "whatsapp", label: "WhatsApp", hosts: ["wa.me", "whatsapp.com"], placeholder: "https://wa.me/919876543210" },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"], placeholder: "https://t.me/yourname" },
  { id: "github", label: "GitHub", hosts: ["github.com"], placeholder: "https://github.com/yourname" },
  { id: "reddit", label: "Reddit", hosts: ["reddit.com"], placeholder: "https://reddit.com/user/yourname" },
  { id: "spotify", label: "Spotify", hosts: ["spotify.com", "spotify.link"], placeholder: "https://open.spotify.com/artist/..." },
  { id: "soundcloud", label: "SoundCloud", hosts: ["soundcloud.com"], placeholder: "https://soundcloud.com/yourname" },
  { id: "apple_music", label: "Apple Music", hosts: ["music.apple.com"], placeholder: "https://music.apple.com/in/artist/..." },
  { id: "threads", label: "Threads", hosts: ["threads.net", "threads.com"], placeholder: "https://threads.net/@yourname" },
  { id: "email", label: "Email", hosts: [], placeholder: "you@example.com" },
  { id: "website", label: "Website", hosts: null, placeholder: "https://example.com" },
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]["id"];

export function isSocialPlatform(value: unknown): value is SocialPlatformId {
  return SOCIAL_PLATFORMS.some((platform) => platform.id === value);
}

export function platformLabel(id: SocialPlatformId): string {
  return SOCIAL_PLATFORMS.find((platform) => platform.id === id)?.label ?? id;
}

function hostMatches(hostname: string, host: string) {
  const name = hostname.toLowerCase();
  return name === host || name.endsWith(`.${host}`);
}

/**
 * Returns a safe stored URL for a platform, or null. A link labelled Instagram must really go
 * to Instagram, so a recognisable icon can't front for somewhere else.
 * This checks where the link points. It does not confirm who owns the account.
 */
export function normalizeSocialUrl(platform: SocialPlatformId, input: string): string | null {
  const definition = SOCIAL_PLATFORMS.find((item) => item.id === platform);
  if (!definition) return null;

  if (platform === "email") {
    const address = input.trim().replace(/^mailto:/i, "");
    const mailto = `mailto:${address}`;
    return isSafeMailto(mailto) && address.length <= 254 ? mailto : null;
  }

  const url = normalizeHttpUrl(input);
  if (!url) return null;
  if (definition.hosts === null) return url;

  const { hostname } = new URL(url);
  return definition.hosts.some((host) => hostMatches(hostname, host)) ? url : null;
}

/** Re-validates a stored link at render time. */
export function toRenderableSocialLink(row: { id: string; platform: string; url: string }) {
  if (!isSocialPlatform(row.platform)) return null;
  const url = normalizeSocialUrl(row.platform, row.url);
  return url ? { id: row.id, platform: row.platform, url } : null;
}
