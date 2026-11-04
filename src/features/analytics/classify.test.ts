import { describe, expect, it } from "vitest";
import { browserCategory, countryCode, deviceCategory, hasOptedOut, isBot, osCategory, referrerCategory } from "./classify";

const UA = {
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
  samsung: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36",
};

describe("isBot", () => {
  it.each([
    "Googlebot/2.1", "Mozilla/5.0 (compatible; bingbot/2.0)", "facebookexternalhit/1.1", "WhatsApp/2.23", "TelegramBot",
    "curl/8.0", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/130.0", "Chrome-Lighthouse", "", null, undefined,
  ])("treats %j as a bot", (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it.each(Object.values(UA))("treats a real browser as a person: %s", (ua) => {
    expect(isBot(ua)).toBe(false);
  });
});

describe("categories", () => {
  it.each([
    [UA.chromeAndroid, "mobile", "Chrome", "Android"],
    [UA.safariIphone, "mobile", "Safari", "iOS"],
    [UA.ipad, "tablet", "Safari", "iOS"],
    [UA.androidTablet, "tablet", "Chrome", "Android"],
    [UA.edgeWindows, "desktop", "Edge", "Windows"],
    [UA.firefoxLinux, "desktop", "Firefox", "Linux"],
    [UA.safariMac, "desktop", "Safari", "macOS"],
    [UA.samsung, "mobile", "Samsung Internet", "Android"],
  ])("reads %s", (ua, device, browser, os) => {
    expect(deviceCategory(ua)).toBe(device);
    expect(browserCategory(ua)).toBe(browser);
    expect(osCategory(ua)).toBe(os);
  });
});

describe("referrerCategory", () => {
  it.each([
    ["", "direct"],
    [undefined, "direct"],
    ["not a url", "direct"],
    [42, "direct"],
    ["https://www.google.com/search?q=secret", "search"],
    ["https://www.bing.com/", "search"],
    ["https://www.instagram.com/", "social"],
    ["https://l.instagram.com/?u=x", "social"],
    ["https://t.co/abc", "social"],
    ["https://x.com/someone", "social"],
    ["https://www.youtube.com/watch", "social"],
    ["https://mail.google.com/mail/u/0", "email"],
    ["https://outlook.live.com/", "email"],
    ["https://someblog.example/post", "other"],
    ["https://findme.example/asha", "direct"],
  ])("reads %j as %s", (referrer, expected) => {
    expect(referrerCategory(referrer, "findme.example")).toBe(expected);
  });

  it("isn't fooled by a lookalike domain", () => {
    expect(referrerCategory("https://google.evil.example/", null)).toBe("other");
    expect(referrerCategory("https://notinstagram.com/", null)).toBe("other");
    expect(referrerCategory("https://instagram.evil.example/", null)).toBe("other");
    expect(referrerCategory("https://google.co.in/", null)).toBe("search");
    expect(referrerCategory("https://lnkd.in/x", null)).toBe("social");
  });
});

describe("countryCode", () => {
  it("accepts two letters, and rejects anything else", () => {
    expect(countryCode("in")).toBe("IN");
    expect(countryCode("XX")).toBeNull();
    expect(countryCode("India")).toBeNull();
    expect(countryCode("I'")).toBeNull();
    expect(countryCode(null)).toBeNull();
  });
});

describe("hasOptedOut", () => {
  it("honours Global Privacy Control and Do Not Track", () => {
    expect(hasOptedOut(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(hasOptedOut(new Headers({ dnt: "1" }))).toBe(true);
    expect(hasOptedOut(new Headers())).toBe(false);
  });
});
