import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, runAs, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;
let aliceProfile: string;
let bobProfile: string;
let bobBlock: string;

const asAlice = () => ({ role: "authenticated", userId: alice }) as const;
const anon = { role: "anon" } as const;
const service = { role: "service_role" } as const;

async function profileId(owner: string) {
  const { rows } = await db.query<{ id: string }>("select id from public.profiles where owner_id = $1", [owner]);
  return rows[0].id;
}

const addLink = (profile: string, url = "https://example.com", extra = "") =>
  db.query<{ id: string }>(
    `insert into public.blocks (profile_id, type, config${extra ? ", starts_at, ends_at" : ""})
     values ($1, 'link', $2${extra ? `, ${extra}` : ""}) returning id`,
    [profile, JSON.stringify({ title: "A link", url })],
  );

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, { display_name: "Alice", username: "alice" });
  bob = await createUser(db, { display_name: "Bob", username: "bob" });
  aliceProfile = await profileId(alice);
  bobProfile = await profileId(bob);
  await db.query("update public.profiles set status = 'published' where id = $1", [bobProfile]);
  bobBlock = (await addLink(bobProfile)).rows[0].id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("blocks access", () => {
  it("lets an owner add, read, change and delete their blocks", async () => {
    await runAs(db, asAlice(), async (q) => {
      const [row] = await q<{ id: string; position: number }>(
        "insert into public.blocks (profile_id, type, config) values ($1, 'heading', $2) returning id, position",
        [aliceProfile, JSON.stringify({ text: "Hi" })],
      );
      // After the Social icons block every page starts with.
      expect(row.position).toBe(1);
      expect(await q("select 1 from public.blocks where id = $1", [row.id])).toHaveLength(1);
      expect(await q("update public.blocks set is_visible = false where id = $1 returning id", [row.id])).toHaveLength(1);
      expect(await q("delete from public.blocks where id = $1 returning id", [row.id])).toHaveLength(1);
    });
  });

  it("appends new blocks after existing ones, ignoring any position sent", async () => {
    await runAs(db, service, async (q) => {
      const [first] = await q<{ position: number }>(
        "insert into public.blocks (profile_id, type, position) values ($1, 'divider', 99) returning position",
        [aliceProfile],
      );
      const [second] = await q<{ position: number }>(
        "insert into public.blocks (profile_id, type) values ($1, 'divider') returning position",
        [aliceProfile],
      );
      const [{ max }] = await q<{ max: number }>("select max(position) as max from public.blocks where profile_id = $1", [aliceProfile]);
      expect(second.position).toBe(first.position + 1);
      expect(second.position).toBe(max);
      expect(first.position).toBeLessThan(99);
    });
  });

  it("hides the table from anonymous visitors", async () => {
    await expect(runAs(db, anon, (q) => q("select * from public.blocks"))).rejects.toThrow(/permission denied/);
  });

  it("stops one user reading or changing another user's blocks", async () => {
    await runAs(db, asAlice(), async (q) => {
      expect(await q("select 1 from public.blocks where id = $1", [bobBlock])).toHaveLength(0);
      expect(await q("update public.blocks set is_visible = false where id = $1 returning id", [bobBlock])).toHaveLength(0);
      expect(await q("delete from public.blocks where id = $1 returning id", [bobBlock])).toHaveLength(0);
    });
  });

  it("stops one user adding a block to another user's page", async () => {
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.blocks (profile_id, type) values ($1, 'divider')", [bobProfile]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let an owner set position or move a block directly", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("update public.blocks set position = 5 where profile_id = $1", [aliceProfile])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, asAlice(), (q) => q("update public.blocks set profile_id = $1 where profile_id = $2", [bobProfile, aliceProfile])),
    ).rejects.toThrow(/permission denied/);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "file:///etc/passwd",
    "//evil.example",
    "https://has space.example",
  ])("rejects the dangerous URL %s, even from a direct call", async (url) => {
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.blocks (profile_id, type, config) values ($1, 'link', $2)", [
          aliceProfile,
          JSON.stringify({ title: "x", url }),
        ]),
      ),
    ).rejects.toThrow(/blocks_url_scheme/);
  });

  it("rejects unknown block types, oversized config and a backwards schedule", async () => {
    const insert = (type: string, config: unknown, schedule = "null, null") =>
      runAs(db, asAlice(), (q) =>
        q(`insert into public.blocks (profile_id, type, config, starts_at, ends_at) values ($1, $2, $3, ${schedule})`, [
          aliceProfile,
          type,
          JSON.stringify(config),
        ]),
      );
    await expect(insert("script", {})).rejects.toThrow(/check/);
    // Random hex doesn't compress away, so this really exceeds the stored size limit.
    const bulk = Array.from({ length: 2000 }, () => crypto.randomUUID()).join("");
    await expect(insert("text", { text: bulk })).rejects.toThrow(/check/);
    await expect(insert("divider", {}, "'2030-01-02', '2030-01-01'")).rejects.toThrow(/blocks_schedule_order/);
  });

  it("caps the number of blocks on a page", async () => {
    const owner = await createUser(db, { username: "manyblocks" });
    const profile = await profileId(owner);
    await db.query("insert into public.blocks (profile_id, type) select $1, 'divider' from generate_series(1, 199)", [profile]);
    await expect(
      runAs(db, service, (q) => q("insert into public.blocks (profile_id, type) values ($1, 'divider')", [profile])),
    ).rejects.toThrow(/block limit reached/);
  });
});

describe("social icons block", () => {
  it("starts every new page with one, at the top", async () => {
    const owner = await createUser(db, { username: "iconsfirst" });
    const { rows } = await db.query<{ type: string; position: number }>(
      "select type, position from public.blocks where profile_id = $1",
      [await profileId(owner)],
    );
    expect(rows).toEqual([{ type: "social_icons", position: 0 }]);
  });

  it("allows only one per page, but lets the owner delete it", async () => {
    const owner = await createUser(db, { username: "iconsonce" });
    const profile = await profileId(owner);
    const as = { role: "authenticated", userId: owner } as const;
    await expect(
      runAs(db, as, (q) => q("insert into public.blocks (profile_id, type) values ($1, 'social_icons')", [profile])),
    ).rejects.toThrow(/blocks_one_social_icons_idx/);
    const deleted = await runAs(db, as, (q) => q("delete from public.blocks where profile_id = $1 and type = 'social_icons' returning id", [profile]));
    expect(deleted).toHaveLength(1);
  });
});

describe("reordering", () => {
  let owner: string;
  let profile: string;
  let ids: string[];

  beforeAll(async () => {
    owner = await createUser(db, { username: "reorderer" });
    profile = await profileId(owner);
    await db.query("delete from public.blocks where profile_id = $1", [profile]);
    ids = [];
    for (let i = 0; i < 3; i += 1) ids.push((await addLink(profile)).rows[0].id);
  });

  const reorder = (list: string[], user = owner, target = profile) =>
    runAs(db, { role: "authenticated", userId: user }, (q) =>
      q("select public.reorder_blocks($1, $2)", [target, list]),
    { commit: true });

  const order = async () =>
    (await db.query<{ id: string }>("select id from public.blocks where profile_id = $1 order by position", [profile])).rows.map((r) => r.id);

  it("saves a new order", async () => {
    await reorder([ids[2], ids[0], ids[1]]);
    expect(await order()).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("rejects a partial, duplicated or foreign list, leaving the order intact", async () => {
    const before = await order();
    await expect(reorder([ids[0], ids[1]])).rejects.toThrow(/out of date/);
    await expect(reorder([ids[0], ids[0], ids[1]])).rejects.toThrow(/out of date/);
    await expect(reorder([ids[0], ids[1], bobBlock])).rejects.toThrow(/out of date/);
    expect(await order()).toEqual(before);
  });

  it("does not let someone reorder another user's page", async () => {
    await expect(reorder(ids, alice)).rejects.toThrow(/not allowed/);
  });
});

describe("public_blocks view", () => {
  let owner: string;
  let profile: string;

  beforeAll(async () => {
    owner = await createUser(db, { username: "scheduler" });
    profile = await profileId(owner);
    await db.query("delete from public.blocks where profile_id = $1", [profile]);
    await db.query("update public.profiles set status = 'published' where id = $1", [profile]);
  });

  const visibleTitles = async () =>
    (
      await runAs(db, anon, (q) =>
        q<{ config: { title: string } }>("select config from public.public_blocks where profile_id = $1", [profile]),
      )
    ).map((r) => r.config.title);

  const add = (title: string, columns: string, values: string) =>
    db.query(`insert into public.blocks (profile_id, type, config${columns}) values ($1, 'link', $2${values})`, [
      profile,
      JSON.stringify({ title, url: "https://example.com" }),
    ]);

  it("shows only blocks that are visible and within their schedule", async () => {
    await add("live", "", "");
    await add("hidden", ", is_visible", ", false");
    await add("future", ", starts_at", ", now() + interval '1 day'");
    await add("expired", ", ends_at", ", now() - interval '1 day'");
    await add("in-window", ", starts_at, ends_at", ", now() - interval '1 day', now() + interval '1 day'");
    expect((await visibleTitles()).sort()).toEqual(["in-window", "live"]);
  });

  it("shows nothing once the page is unpublished", async () => {
    await db.query("update public.profiles set status = 'unpublished' where id = $1", [profile]);
    expect(await visibleTitles()).toEqual([]);
    await db.query("update public.profiles set status = 'published' where id = $1", [profile]);
  });

  it("shows nothing for a suspended account", async () => {
    await db.query("update public.accounts set status = 'suspended' where id = $1", [owner]);
    expect(await visibleTitles()).toEqual([]);
    await db.query("update public.accounts set status = 'active' where id = $1", [owner]);
  });

  it("shows nothing from drafts", async () => {
    await addLink(aliceProfile);
    const rows = await runAs(db, anon, (q) => q("select 1 from public.public_blocks where profile_id = $1", [aliceProfile]));
    expect(rows).toHaveLength(0);
  });
});

describe("social links", () => {
  it("enforces ownership, one link per platform, and safe URLs", async () => {
    await runAs(db, asAlice(), (q) =>
      q("insert into public.social_links (profile_id, platform, url) values ($1, 'github', 'https://github.com/a')", [aliceProfile]),
    { commit: true });
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.social_links (profile_id, platform, url) values ($1, 'github', 'https://github.com/b')", [aliceProfile]),
      ),
    ).rejects.toThrow(/unique/);
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.social_links (profile_id, platform, url) values ($1, 'x', 'javascript:alert(1)')", [aliceProfile]),
      ),
    ).rejects.toThrow(/check/);
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.social_links (profile_id, platform, url) values ($1, 'x', 'https://x.com/a')", [bobProfile]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.social_links (profile_id, platform, url) values ($1, 'myspace', 'https://x.com/a')", [aliceProfile]),
      ),
    ).rejects.toThrow(/check/);
  });

  it("exposes only visible links on published pages", async () => {
    await db.query(
      "insert into public.social_links (profile_id, platform, url, is_visible) values ($1, 'x', 'https://x.com/b', true), ($1, 'github', 'https://github.com/b', false)",
      [bobProfile],
    );
    const rows = await runAs(db, anon, (q) =>
      q<{ platform: string }>("select platform from public.public_social_links where profile_id = $1", [bobProfile]),
    );
    expect(rows.map((r) => r.platform)).toEqual(["x"]);
  });
});

describe("suspended accounts", () => {
  let owner: string;
  let profile: string;
  let block: string;

  beforeAll(async () => {
    owner = await createUser(db, { username: "suspendedwriter", display_name: "S" });
    profile = await profileId(owner);
    block = (await addLink(profile)).rows[0].id;
    await db.query("update public.accounts set status = 'suspended' where id = $1", [owner]);
  });

  const asSuspended = () => ({ role: "authenticated", userId: owner }) as const;

  it("can still read their own data", async () => {
    expect(await runAs(db, asSuspended(), (q) => q("select 1 from public.blocks where id = $1", [block]))).toHaveLength(1);
  });

  it("cannot write through the API", async () => {
    await runAs(db, asSuspended(), async (q) => {
      expect(await q("update public.profiles set bio = 'x' where id = $1 returning id", [profile])).toHaveLength(0);
      expect(await q("update public.accounts set display_name = 'x' where id = $1 returning id", [owner])).toHaveLength(0);
      expect(await q("update public.blocks set is_visible = false where id = $1 returning id", [block])).toHaveLength(0);
      expect(await q("delete from public.blocks where id = $1 returning id", [block])).toHaveLength(0);
    });
    await expect(
      runAs(db, asSuspended(), (q) => q("insert into public.blocks (profile_id, type) values ($1, 'divider')", [profile])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      runAs(db, asSuspended(), (q) => q("select public.reorder_blocks($1, $2)", [profile, [block]])),
    ).rejects.toThrow(/not allowed/);
  });
});

describe("profile versioning", () => {
  it("increments on every update and can't be forged", async () => {
    const owner = await createUser(db, { username: "versioned" });
    const profile = await profileId(owner);
    const version = async () =>
      Number((await db.query<{ version: string }>("select version from public.profiles where id = $1", [profile])).rows[0].version);
    const start = await version();
    await db.query("update public.profiles set bio = 'a' where id = $1", [profile]);
    expect(await version()).toBe(start + 1);
    await expect(
      runAs(db, { role: "authenticated", userId: owner }, (q) => q("update public.profiles set version = 1 where id = $1", [profile])),
    ).rejects.toThrow(/permission denied/);
  });

  it("ignores publishing and renaming, which can't lose anyone's edits", async () => {
    const owner = await createUser(db, { username: "versionstays" });
    const profile = await profileId(owner);
    const version = async () =>
      Number((await db.query<{ version: string }>("select version from public.profiles where id = $1", [profile])).rows[0].version);
    const start = await version();
    await db.query("update public.profiles set status = 'published' where id = $1", [profile]);
    await db.query("update public.profiles set username = 'versionstays2' where id = $1", [profile]);
    expect(await version()).toBe(start);
  });

  it("makes a stale write affect no rows", async () => {
    const owner = await createUser(db, { username: "stalewrite" });
    const profile = await profileId(owner);
    await db.query("update public.profiles set bio = 'newer' where id = $1", [profile]);
    const rows = await runAs(db, { role: "authenticated", userId: owner }, (q) =>
      q("update public.profiles set bio = 'stale' where id = $1 and version = 1 returning id", [profile]),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("username changes", () => {
  const rename = (user: string, profile: string, username: string) =>
    runAs(db, { role: "authenticated", userId: user }, (q) =>
      q("update public.profiles set username = $1 where id = $2", [username, profile]),
    { commit: true });

  it("holds a released name for 30 days, for everyone but its former owner", async () => {
    const first = await createUser(db, { username: "oldname" });
    const firstProfile = await profileId(first);
    await rename(first, firstProfile, "newname");

    const available = await runAs(db, anon, (q) => q<{ a: boolean }>("select public.is_username_available('oldname') as a"));
    expect(available[0].a).toBe(false);

    const thief = await createUser(db, { username: "thief" });
    await db.query("update public.profiles set username_changed_at = null where owner_id = $1", [thief]);
    await expect(rename(thief, await profileId(thief), "oldname")).rejects.toThrow(/not available/);

    await db.query("update public.profiles set username_changed_at = null where id = $1", [firstProfile]);
    await rename(first, firstProfile, "oldname");
    const { rows } = await db.query<{ username: string }>("select username from public.profiles where id = $1", [firstProfile]);
    expect(rows[0].username).toBe("oldname");
  });

  it("frees a name once the hold has passed", async () => {
    const owner = await createUser(db, { username: "heldname" });
    await rename(owner, await profileId(owner), "movedon");
    await db.query("update public.username_history set released_at = now() - interval '31 days' where username = 'heldname'");
    const available = await runAs(db, anon, (q) => q<{ a: boolean }>("select public.is_username_available('heldname') as a"));
    expect(available[0].a).toBe(true);
  });

  it("allows only one rename a day", async () => {
    const owner = await createUser(db, { username: "quickchange" });
    const profile = await profileId(owner);
    await rename(owner, profile, "quickchange2");
    await expect(rename(owner, profile, "quickchange3")).rejects.toThrow(/changed recently/);
  });

  it("keeps the history closed to clients", async () => {
    await expect(runAs(db, anon, (q) => q("select * from public.username_history"))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, asAlice(), (q) => q("select * from public.username_history"))).rejects.toThrow(/permission denied/);
  });
});

describe("leads", () => {
  it("cannot be written by visitors or other users, only read by the page owner", async () => {
    await expect(
      runAs(db, anon, (q) =>
        q("insert into public.leads (profile_id, kind, email, consent_text) values ($1, 'newsletter', 'a@b.co', 'yes')", [bobProfile]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.leads (profile_id, kind, email, consent_text) values ($1, 'newsletter', 'a@b.co', 'yes')", [bobProfile]),
      ),
    ).rejects.toThrow(/permission denied/);

    await db.query(
      "insert into public.leads (profile_id, kind, email, consent_text) values ($1, 'newsletter', 'fan@example.test', 'I agree')",
      [bobProfile],
    );
    expect(await runAs(db, asAlice(), (q) => q("select * from public.leads where profile_id = $1", [bobProfile]))).toHaveLength(0);
    expect(await runAs(db, asAlice(), (q) => q("delete from public.leads where profile_id = $1 returning id", [bobProfile]))).toHaveLength(0);
    expect(
      await runAs(db, { role: "authenticated", userId: bob }, (q) => q("select email from public.leads where profile_id = $1", [bobProfile])),
    ).toEqual([{ email: "fan@example.test" }]);
    expect(await runAs(db, anon, () => Promise.resolve("anon has no read grant"))).toBeTruthy();
    await expect(runAs(db, anon, (q) => q("select * from public.leads"))).rejects.toThrow(/permission denied/);
  });

  it("removes duplicate newsletter signups", async () => {
    const insert = () =>
      db.query("insert into public.leads (profile_id, kind, email, consent_text) values ($1, 'newsletter', 'dupe@example.test', 'I agree')", [bobProfile]);
    await insert();
    await expect(insert()).rejects.toThrow(/unique/);
  });
});

describe("contact submissions", () => {
  it("is closed to everyone but staff and the server", async () => {
    await runAs(db, service, (q) => q("insert into public.contact_submissions (name, email, message) values ('a', 'a@b.co', 'hi')"), { commit: true });
    await expect(runAs(db, anon, (q) => q("select * from public.contact_submissions"))).rejects.toThrow(/permission denied/);
    expect(await runAs(db, asAlice(), (q) => q("select * from public.contact_submissions"))).toHaveLength(0);
    await expect(
      runAs(db, asAlice(), (q) => q("insert into public.contact_submissions (name, email, message) values ('a', 'a@b.co', 'hi')")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("media storage", () => {
  const upload = (user: string, name: string) =>
    runAs(db, { role: "authenticated", userId: user }, (q) =>
      q("insert into storage.objects (bucket_id, name) values ('profile-media', $1) returning name", [name]),
    );

  it("rejects SVG and limits file size in the bucket itself", async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'profile-media'",
    );
    expect(rows[0].public).toBe(true);
    expect(Number(rows[0].file_size_limit)).toBe(5 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).not.toContain("image/svg+xml");
  });

  it("confines uploads to the user's own folder", async () => {
    await expect(upload(alice, `${alice}/photo.png`)).resolves.toHaveLength(1);
    await expect(upload(alice, `${bob}/photo.png`)).rejects.toThrow(/row-level security/);
    await expect(upload(alice, "photo.png")).rejects.toThrow(/row-level security/);
  });

  it("does not let a user delete someone else's file", async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('profile-media', $1)", [`${bob}/keep.png`]);
    const rows = await runAs(db, { role: "authenticated", userId: alice }, (q) =>
      q("delete from storage.objects where name = $1 returning name", [`${bob}/keep.png`]),
    );
    expect(rows).toHaveLength(0);
  });
});
