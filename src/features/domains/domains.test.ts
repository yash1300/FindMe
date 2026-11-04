import { describe, expect, it } from "vitest";
import { isAppHost, normalizeHostname, txtRecordsContain, verificationRecordName } from "./host";

const APP = "https://findme-dun.vercel.app";

describe("isAppHost", () => {
  it.each([
    ["findme-dun.vercel.app", APP],
    ["FINDME-DUN.vercel.app", APP],
    ["localhost:3000", APP],
    ["127.0.0.1:3000", APP],
    ["findme-git-branch.vercel.app", APP],
    ["findme.com", "https://findme.com"],
  ])("treats %s as the app", (host, url) => {
    expect(isAppHost(host, url)).toBe(true);
  });

  it.each(["asha.example.com", "findme.com.evil.example"])("treats %s as a custom domain", (host) => {
    expect(isAppHost(host, "https://findme.com")).toBe(false);
  });
});

describe("normalizeHostname", () => {
  it.each([
    ["links.asha.in", "links.asha.in"],
    ["  LINKS.Asha.IN ", "links.asha.in"],
    ["https://links.asha.in/", "links.asha.in"],
    ["asha.co.in", "asha.co.in"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeHostname(input, APP)).toBe(expected);
  });

  it.each([
    "localhost", "not a domain", "a..b.com", "-bad.example.org", "x.com/path", "http://x.com/y", "1.2.3.4", "",
    "findme-dun.vercel.app", "anything.vercel.app", "x.supabase.co", "foo.local", "foo.internal", "foo.test",
    "x.com:8080", "evil.com#x", "user@evil.com", null, 42,
  ])("rejects %j", (input) => {
    expect(normalizeHostname(input, APP)).toBeNull();
  });

  it("rejects the app's own domain and anything under it", () => {
    expect(normalizeHostname("findme.com", "https://findme.com")).toBeNull();
    expect(normalizeHostname("admin.findme.com", "https://findme.com")).toBeNull();
  });
});

describe("verification", () => {
  it("names the record", () => {
    expect(verificationRecordName("links.asha.in")).toBe("_findme.links.asha.in");
  });

  it("matches the token exactly, including DNS splitting long values into chunks", () => {
    expect(txtRecordsContain([["abc"], ["def", "123"]], "def123")).toBe(true);
    expect(txtRecordsContain([["abc123extra"]], "abc123")).toBe(false);
    expect(txtRecordsContain([], "abc")).toBe(false);
  });
});
