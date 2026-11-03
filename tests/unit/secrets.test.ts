// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(join(root, "src")).map((path) => ({
  path: relative(root, path).replaceAll("\\", "/"),
  content: readFileSync(path, "utf8"),
}));

describe("privileged credential boundaries", () => {
  it("reads the service-role key in exactly one file", () => {
    const readers = files.filter((file) => file.content.includes("process.env.SUPABASE_SERVICE_ROLE_KEY"));
    expect(readers.map((file) => file.path)).toEqual(["src/lib/supabase/admin.ts"]);
  });

  it("guards the admin client with server-only", () => {
    const admin = files.find((file) => file.path === "src/lib/supabase/admin.ts");
    expect(admin?.content).toMatch(/^import "server-only";/);
  });

  it("never exposes a secret through a NEXT_PUBLIC_ variable", () => {
    const pattern = /NEXT_PUBLIC_\w*(SERVICE|SECRET|PASSWORD|PRIVATE)\w*/;
    const offenders = files.filter((file) => pattern.test(file.content));
    const example = readFileSync(join(root, ".env.example"), "utf8");
    expect(offenders.map((file) => file.path)).toEqual([]);
    expect(example).not.toMatch(pattern);
  });

  it("does not import the admin client from client components", () => {
    const offenders = files.filter(
      (file) => /^["']use client["']/m.test(file.content) && file.content.includes("supabase/admin"),
    );
    expect(offenders).toEqual([]);
  });

  it("uses the pill-capable button radius only on buttons", () => {
    const css = readFileSync(join(root, "src/features/profile/profile.css"), "utf8");
    const uses = css.match(/var\(--fm-radius\)/g) ?? [];
    expect(uses).toHaveLength(1);
  });

  it("does not render raw HTML anywhere", () => {
    const offenders = files.filter((file) => file.content.includes("dangerouslySetInnerHTML"));
    expect(offenders.map((file) => file.path)).toEqual([]);
  });
});
