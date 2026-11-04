import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, runAs, type TestDb } from "./harness";

let db: TestDb;
let owner: string;
let profile: string;
let block: string;

const anon = { role: "anon" } as const;
const service = { role: "service_role" } as const;

type EventInput = { profileId?: string; blockId?: string | null; type?: string; source?: string; referrer?: string | null; device?: string | null; browser?: string | null; os?: string | null; country?: string | null };

async function record(input: EventInput = {}): Promise<boolean> {
  const rows = await runAs(
    db,
    service,
    (q) =>
      q<{ ok: boolean }>("select public.record_analytics_event($1, $2, $3, $4, $5, $6, $7, $8, $9) as ok", [
        input.profileId ?? profile,
        input.blockId ?? null,
        input.type ?? "view",
        input.source ?? "1.1.1.1|ua",
        input.referrer === undefined ? "direct" : input.referrer,
        input.device === undefined ? "mobile" : input.device,
        input.browser === undefined ? "Chrome" : input.browser,
        input.os === undefined ? "Android" : input.os,
        input.country === undefined ? "IN" : input.country,
      ]),
    { commit: true },
  );
  return rows[0].ok;
}

async function totals(id = profile) {
  const { rows } = await db.query<{ views: number; clicks: number; uniques: number }>(
    "select views, clicks, uniques from public.analytics_daily where profile_id = $1 and dimension = 'total'",
    [id],
  );
  return rows[0] ?? { views: 0, clicks: 0, uniques: 0 };
}

async function freshPage(username: string) {
  const id = await createUser(db, { username });
  const { rows } = await db.query<{ id: string }>("select id from public.profiles where owner_id = $1", [id]);
  await db.query("update public.profiles set status = 'published' where id = $1", [rows[0].id]);
  return { ownerId: id, profileId: rows[0].id };
}

beforeAll(async () => {
  db = await createTestDb();
  ({ ownerId: owner, profileId: profile } = await freshPage("analytics"));
  const { rows } = await db.query<{ id: string }>(
    "insert into public.blocks (profile_id, type, config) values ($1, 'link', $2) returning id",
    [profile, JSON.stringify({ title: "x", url: "https://example.com" })],
  );
  block = rows[0].id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("recording events", () => {
  it("counts a view, a unique visitor, and each breakdown", async () => {
    const page = await freshPage("breakdowns");
    expect(await record({ profileId: page.profileId })).toBe(true);
    expect(await totals(page.profileId)).toEqual({ views: 1, clicks: 0, uniques: 1 });
    const { rows } = await db.query<{ dimension: string; dimension_value: string; views: number }>(
      "select dimension, dimension_value, views from public.analytics_daily where profile_id = $1 and dimension <> 'total' order by dimension",
      [page.profileId],
    );
    expect(rows).toEqual([
      { dimension: "browser", dimension_value: "Chrome", views: 1 },
      { dimension: "country", dimension_value: "IN", views: 1 },
      { dimension: "device", dimension_value: "mobile", views: 1 },
      { dimension: "os", dimension_value: "Android", views: 1 },
      { dimension: "referrer", dimension_value: "direct", views: 1 },
    ]);
  });

  it("ignores a repeat view from the same visitor, without inflating totals", async () => {
    const page = await freshPage("dedupe");
    expect(await record({ profileId: page.profileId, source: "same" })).toBe(true);
    expect(await record({ profileId: page.profileId, source: "same" })).toBe(false);
    expect(await totals(page.profileId)).toEqual({ views: 1, clicks: 0, uniques: 1 });
  });

  it("counts a later view today as a view, but not as a new visitor", async () => {
    const page = await freshPage("laterview");
    await record({ profileId: page.profileId, source: "same" });
    await db.query("update public.analytics_events set dedupe_key = 'old', occurred_at = now() - interval '1 hour' where profile_id = $1", [page.profileId]);
    expect(await record({ profileId: page.profileId, source: "same" })).toBe(true);
    expect(await totals(page.profileId)).toEqual({ views: 2, clicks: 0, uniques: 1 });
  });

  it("counts different visitors separately", async () => {
    const page = await freshPage("twovisitors");
    await record({ profileId: page.profileId, source: "one" });
    await record({ profileId: page.profileId, source: "two" });
    expect(await totals(page.profileId)).toEqual({ views: 2, clicks: 0, uniques: 2 });
  });

  it("counts a click against its block", async () => {
    expect(await record({ type: "click", blockId: block, source: "clicker" })).toBe(true);
    expect((await totals()).clicks).toBe(1);
    const { rows } = await db.query<{ clicks: number }>(
      "select clicks from public.analytics_daily where profile_id = $1 and dimension = 'block' and dimension_value = $2",
      [profile, block],
    );
    expect(rows[0].clicks).toBe(1);
    expect(await record({ type: "click", blockId: block, source: "clicker" })).toBe(false);
  });

  it("refuses a click on a block from another page", async () => {
    const other = await freshPage("otherpage");
    expect(await record({ profileId: other.profileId, type: "click", blockId: block, source: "x" })).toBe(false);
  });

  it("ignores drafts, unpublished pages and suspended accounts", async () => {
    const draftOwner = await createUser(db, { username: "draftpage" });
    const { rows } = await db.query<{ id: string }>("select id from public.profiles where owner_id = $1", [draftOwner]);
    expect(await record({ profileId: rows[0].id })).toBe(false);

    const page = await freshPage("suspendedpage");
    await db.query("update public.accounts set status = 'suspended' where id = $1", [page.ownerId]);
    expect(await record({ profileId: page.profileId })).toBe(false);
  });

  it("records nothing when the creator has turned analytics off", async () => {
    const page = await freshPage("optedout");
    await runAs(db, { role: "authenticated", userId: page.ownerId }, (q) =>
      q("update public.profiles set analytics_enabled = false where id = $1", [page.profileId]),
    { commit: true });
    expect(await record({ profileId: page.profileId })).toBe(false);
    expect(await totals(page.profileId)).toEqual({ views: 0, clicks: 0, uniques: 0 });
  });

  it("rejects unknown event types", async () => {
    await expect(record({ type: "purchase" })).rejects.toThrow(/unknown event type/);
  });
});

describe("privacy", () => {
  it("never stores the visitor's IP or user agent, in any column", async () => {
    await record({ source: "203.0.113.77|SecretBrowser/1.0" });
    const { rows } = await db.query("select * from public.analytics_events");
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain("203.0.113.77");
    expect(stored).not.toContain("SecretBrowser");
  });

  it("gives one visitor a different hash on each page, so they can't be linked across creators", async () => {
    const a = await freshPage("hasha");
    const b = await freshPage("hashb");
    await record({ profileId: a.profileId, source: "same-person" });
    await record({ profileId: b.profileId, source: "same-person" });
    const { rows } = await db.query<{ visitor_hash: string }>(
      "select visitor_hash from public.analytics_events where profile_id = any($1)",
      [[a.profileId, b.profileId]],
    );
    expect(new Set(rows.map((row) => row.visitor_hash)).size).toBe(2);
  });

  it("destroys old salts, so past hashes can't be recreated", async () => {
    await db.query("insert into public.analytics_salts (day, salt) values (current_date - 5, 'old') on conflict do nothing");
    await record({ source: "salt-check" });
    const { rows } = await db.query("select 1 from public.analytics_salts where salt = 'old'");
    expect(rows).toHaveLength(0);
  });

  it("deletes raw events after 30 days, and keeps daily totals", async () => {
    const page = await freshPage("retention");
    await record({ profileId: page.profileId, source: "old-visitor" });
    await record({ profileId: page.profileId, source: "new-visitor" });
    await db.query(
      "update public.analytics_events set occurred_at = now() - interval '31 days' where profile_id = $1 and id = (select id from public.analytics_events where profile_id = $1 limit 1)",
      [page.profileId],
    );
    await runAs(db, service, (q) => q("select public.purge_expired_analytics()"), { commit: true });
    const events = await db.query("select 1 from public.analytics_events where profile_id = $1", [page.profileId]);
    expect(events.rows).toHaveLength(1);
    expect((await totals(page.profileId)).views).toBe(2);
  });
});

describe("access", () => {
  it("closes raw events and salts to everyone but the server, including the page's owner", async () => {
    for (const table of ["analytics_events", "analytics_salts"]) {
      await expect(runAs(db, anon, (q) => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
      await expect(
        runAs(db, { role: "authenticated", userId: owner }, (q) => q(`select * from public.${table}`)),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("lets an owner read only their own daily totals", async () => {
    const other = await freshPage("privatestats");
    await record({ profileId: other.profileId, source: "z" });
    await record({ source: "owner-visitor" });
    const rows = await runAs(db, { role: "authenticated", userId: owner }, (q) =>
      q<{ profile_id: string }>("select profile_id from public.analytics_daily"),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.profile_id))).toEqual(new Set([profile]));
  });

  it("doesn't let anyone forge totals", async () => {
    await expect(runAs(db, anon, (q) => q("select * from public.analytics_daily"))).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, { role: "authenticated", userId: owner }, (q) =>
        q("update public.analytics_daily set views = 999999 where profile_id = $1", [profile]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, { role: "authenticated", userId: owner }, (q) =>
        q("insert into public.analytics_daily (profile_id, day, dimension, dimension_value, views) values ($1, current_date, 'total', 'x', 9)", [profile]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it.each([
    ["record_analytics_event", "$1::uuid, null, 'view', 'x', null, null, null, null, null"],
    ["purge_expired_analytics", ""],
    ["admin_overview", ""],
  ])("doesn't let clients call %s", async (fn, args) => {
    const sql = `select public.${fn}(${args})`;
    const params = args ? [profile] : [];
    await expect(runAs(db, anon, (q) => q(sql, params))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, { role: "authenticated", userId: owner }, (q) => q(sql, params))).rejects.toThrow(/permission denied/);
  });

  it("removes analytics with the account", async () => {
    const page = await freshPage("deleteme");
    await record({ profileId: page.profileId, source: "v" });
    await db.query("delete from auth.users where id = $1", [page.ownerId]);
    const events = await db.query("select 1 from public.analytics_events where profile_id = $1", [page.profileId]);
    const daily = await db.query("select 1 from public.analytics_daily where profile_id = $1", [page.profileId]);
    expect(events.rows).toHaveLength(0);
    expect(daily.rows).toHaveLength(0);
  });
});

describe("admin_overview", () => {
  it("returns figures to the server", async () => {
    const [row] = await runAs(db, service, (q) => q<{ o: { registered_users: number; total_views: number } }>("select public.admin_overview() as o"));
    expect(row.o.registered_users).toBeGreaterThan(0);
    expect(row.o.total_views).toBeGreaterThan(0);
  });
});
