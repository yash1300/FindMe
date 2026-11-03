import { afterEach, describe, expect, it, vi } from "vitest";
import { isMediaPathOwnedBy, publicMediaUrl, sniffImage } from "./paths";

const user = "11111111-1111-1111-1111-111111111111";
const file = "22222222-2222-2222-2222-222222222222";
const path = `${user}/${file}.png`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicMediaUrl", () => {
  it("builds a URL inside the media bucket", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test/");
    expect(publicMediaUrl(path)).toBe(`https://db.example.test/storage/v1/object/public/profile-media/${path}`);
  });

  it.each([null, undefined, "", "../../secret", `${user}/../${file}.png`, `${user}/${file}.svg`, "https://evil.example/x.png"])(
    "rejects %j",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
      expect(publicMediaUrl(value)).toBeNull();
    },
  );
});

describe("isMediaPathOwnedBy", () => {
  it("matches only the owner's own folder", () => {
    expect(isMediaPathOwnedBy(path, user)).toBe(true);
    expect(isMediaPathOwnedBy(path, file)).toBe(false);
  });
});

describe("sniffImage", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

  it("recognises supported formats", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.extension).toBe("png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.extension).toBe("jpg");
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))?.extension).toBe("gif");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))?.extension).toBe("webp");
  });

  it("rejects SVG, HTML and executables, whatever they claim to be", () => {
    const text = (value: string) => new TextEncoder().encode(value);
    expect(sniffImage(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(text("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffImage(bytes(0x4d, 0x5a))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});
