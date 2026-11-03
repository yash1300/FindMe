// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROHIBITED_USERNAMES, RESERVED_USERNAMES } from "@/features/usernames/reserved";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationsDir)
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n");

function seededNames(kind: "reserved" | "prohibited"): string[] {
  const pattern = new RegExp(`unnest\\(array\\[([^\\]]*)\\]\\), '${kind}'`, "g");
  return [...migrations.matchAll(pattern)].flatMap((match) =>
    [...match[1].matchAll(/'([^']+)'/g)].map((name) => name[1]),
  );
}

/** Top-level URL segments, looking through route groups like (auth). */
function topLevelRoutes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      if (/^\(.*\)$/.test(entry.name)) return topLevelRoutes(join(dir, entry.name));
      if (entry.name.startsWith("[") || entry.name.startsWith("_")) return [];
      return [entry.name];
    });
}

describe("reserved usernames", () => {
  it("match the database seed exactly", () => {
    expect(seededNames("reserved").sort()).toEqual([...RESERVED_USERNAMES].sort());
    expect(seededNames("prohibited").sort()).toEqual([...PROHIBITED_USERNAMES].sort());
  });

  it("cover every top-level route, so no username can shadow a page", () => {
    const routes = topLevelRoutes(join(process.cwd(), "src", "app"));
    expect(routes.length).toBeGreaterThan(0);
    const missing = routes.filter((route) => !(RESERVED_USERNAMES as readonly string[]).includes(route));
    expect(missing).toEqual([]);
  });
});
