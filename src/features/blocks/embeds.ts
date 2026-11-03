export type Embed = {
  provider: "youtube" | "vimeo" | "spotify" | "soundcloud";
  /** Built only from validated parts, so it can never point anywhere else. */
  src: string;
  title: string;
  height: number | null;
  thumbnail: string | null;
};

function parse(input: string): URL | null {
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTube(input: string): Embed | null {
  const url = parse(input);
  if (!url) return null;
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");

  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1);
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "embed" || first === "shorts" || first === "live") id = second ?? null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;

  return {
    provider: "youtube",
    src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
    title: "YouTube video",
    height: null,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

export function parseVimeo(input: string): Embed | null {
  const url = parse(input);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const id = segments.find((segment) => /^[0-9]{6,12}$/.test(segment));
  if (!id) return null;

  return {
    provider: "vimeo",
    src: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`,
    title: "Vimeo video",
    height: null,
    thumbnail: null,
  };
}

export function parseVideo(input: string): Embed | null {
  return parseYouTube(input) ?? parseVimeo(input);
}

const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "artist", "episode", "show"]);

export function parseSpotify(input: string): Embed | null {
  const url = parse(input);
  if (!url || url.hostname !== "open.spotify.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  // Links may start with a locale, such as /intl-en/, or /embed/.
  const start = segments.findIndex((segment) => SPOTIFY_TYPES.has(segment));
  if (start === -1) return null;
  const [type, id] = segments.slice(start);
  if (!id || !/^[A-Za-z0-9]{10,32}$/.test(id)) return null;

  return {
    provider: "spotify",
    src: `https://open.spotify.com/embed/${type}/${id}`,
    title: "Spotify player",
    height: type === "track" || type === "episode" ? 152 : 352,
    thumbnail: null,
  };
}

export function parseSoundCloud(input: string): Embed | null {
  const url = parse(input);
  if (!url) return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  if (host !== "soundcloud.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || !segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment))) return null;

  const track = encodeURIComponent(`https://soundcloud.com/${segments.join("/")}`);
  return {
    provider: "soundcloud",
    src: `https://w.soundcloud.com/player/?url=${track}&color=%23111827&auto_play=false&show_comments=false&show_reposts=false&visual=false`,
    title: "SoundCloud player",
    height: 166,
    thumbnail: null,
  };
}

/** Every origin the embeds above can load. The Content-Security-Policy allows only these. */
export const EMBED_FRAME_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://open.spotify.com",
  "https://w.soundcloud.com",
] as const;
