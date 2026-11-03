import { describe, expect, it } from "vitest";
import { EMBED_FRAME_ORIGINS, parseSoundCloud, parseSpotify, parseVideo, parseVimeo, parseYouTube } from "./embeds";

describe("parseYouTube", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("reads %s", (input) => {
    const embed = parseYouTube(input);
    expect(embed?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
  });

  it.each([
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    'https://www.youtube.com/watch?v="><script>',
    "https://youtu.be/dQw4w9WgXcQ/../../evil",
    "javascript:alert(1)",
    "not a url",
  ])("rejects %s", (input) => {
    expect(parseYouTube(input)).toBeNull();
  });
});

describe("parseVimeo", () => {
  it("reads a video link", () => {
    expect(parseVimeo("https://vimeo.com/123456789")?.src).toContain("player.vimeo.com/video/123456789");
  });

  it("rejects other hosts", () => {
    expect(parseVimeo("https://vimeo.com.evil.example/123456789")).toBeNull();
  });
});

describe("parseVideo", () => {
  it("accepts YouTube and Vimeo, and nothing else", () => {
    expect(parseVideo("https://youtu.be/dQw4w9WgXcQ")?.provider).toBe("youtube");
    expect(parseVideo("https://vimeo.com/123456789")?.provider).toBe("vimeo");
    expect(parseVideo("https://evil.example/video.mp4")).toBeNull();
  });
});

describe("parseSpotify", () => {
  it.each([
    ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "track", 152],
    ["https://open.spotify.com/intl-en/track/4cOdK2wGLETKBW3PvgPWqT?si=abc", "track", 152],
    ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "playlist", 352],
  ])("reads %s", (input, type, height) => {
    const embed = parseSpotify(input);
    expect(embed?.src).toContain(`/embed/${type}/`);
    expect(embed?.height).toBe(height);
  });

  it.each(["https://spotify.evil.example/track/4cOdK2wGLETKBW3PvgPWqT", "https://open.spotify.com/user/someone", "https://open.spotify.com/track/%22%3E"])(
    "rejects %s",
    (input) => {
      expect(parseSpotify(input)).toBeNull();
    },
  );
});

describe("parseSoundCloud", () => {
  it("reads a track and encodes it into the player URL", () => {
    const embed = parseSoundCloud("https://soundcloud.com/artist/track-name?si=x");
    expect(embed?.src).toContain("https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-name&");
  });

  it.each(["https://soundcloud.com/artist", "https://evil.example/artist/track", "https://soundcloud.com/a/%22%3E%3Cscript%3E"])(
    "rejects %s",
    (input) => {
      expect(parseSoundCloud(input)).toBeNull();
    },
  );
});

describe("embed origins", () => {
  it("cover every provider, so the CSP and parsers can't drift apart", () => {
    const sources = [
      parseYouTube("https://youtu.be/dQw4w9WgXcQ"),
      parseVimeo("https://vimeo.com/123456789"),
      parseSpotify("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
      parseSoundCloud("https://soundcloud.com/a/b"),
    ];
    for (const embed of sources) {
      expect(EMBED_FRAME_ORIGINS).toContain(new URL(embed!.src).origin);
    }
  });
});
