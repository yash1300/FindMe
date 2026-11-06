import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, runAs, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;

const asAlice = () => ({ role: "authenticated", userId: alice }) as const;
const asBob = () => ({ role: "authenticated", userId: bob }) as const;
const anon = { role: "anon" } as const;
const service = { role: "service_role" } as const;

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, { display_name: "Alice", username: "alice" });
  bob = await createUser(db, { display_name: "Bob", username: "bob" });
  await db.query("update public.profiles set status = 'published' where username = 'bob'");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("user provisioning", () => {
  it("creates an account and draft profile from signup metadata", async () => {
    const { rows } = await db.query<{ display_name: string; username: string; status: string; locale: string; timezone: string; currency: string }>(
      `select a.display_name, p.username, p.status, a.locale, a.timezone, a.currency
       from public.accounts a join public.profiles p on p.owner_id = a.id where a.id = $1`,
      [alice],
    );
    expect(rows[0]).toEqual({
      display_name: "Alice",
      username: "alice",
      status: "draft",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
    });
  });

  it("does not fail signup when the username is already taken", async () => {
    const id = await createUser(db, { display_name: "Late", username: "alice" });
    const accounts = await db.query("select 1 from public.accounts where id = $1", [id]);
    const profiles = await db.query("select 1 from public.profiles where owner_id = $1", [id]);
    expect(accounts.rows).toHaveLength(1);
    expect(profiles.rows).toHaveLength(0);
  });

  it("does not fail signup for a reserved or malformed username", async () => {
    for (const username of ["admin", "no spaces!", "x"]) {
      const id = await createUser(db, { username });
      const profiles = await db.query("select 1 from public.profiles where owner_id = $1", [id]);
      expect(profiles.rows, username).toHaveLength(0);
    }
  });

  it("normalises the case of a username from metadata", async () => {
    const id = await createUser(db, { username: "MixedCase" });
    const { rows } = await db.query<{ username: string }>("select username from public.profiles where owner_id = $1", [id]);
    expect(rows[0].username).toBe("mixedcase");
  });

  it("uses Google's name but never the email as a display name", async () => {
    const google = await createUser(db, { full_name: "Google Name" }, "secret@example.test");
    const bare = await createUser(db, {}, "private@example.test");
    const names = await db.query<{ id: string; display_name: string }>(
      "select id, display_name from public.accounts where id = any($1)",
      [[google, bare]],
    );
    expect(names.rows.find((r) => r.id === google)?.display_name).toBe("Google Name");
    expect(names.rows.find((r) => r.id === bare)?.display_name).toBe("FindMe creator");
  });

  it("records consent versions with a timestamp, and none when absent", async () => {
    const consented = await createUser(db, { terms_version: "v1", privacy_version: "v1" });
    const silent = await createUser(db, {});
    const { rows } = await db.query<{ id: string; terms_accepted_at: Date | null; privacy_accepted_version: string | null }>(
      "select id, terms_accepted_at, privacy_accepted_version from public.accounts where id = any($1)",
      [[consented, silent]],
    );
    const a = rows.find((r) => r.id === consented);
    const b = rows.find((r) => r.id === silent);
    expect(a?.terms_accepted_at).toBeInstanceOf(Date);
    expect(a?.privacy_accepted_version).toBe("v1");
    expect(b?.terms_accepted_at).toBeNull();
  });

  it("deleting a user cascades to their account and profile", async () => {
    const id = await createUser(db, { username: "leaving" });
    await db.query("delete from auth.users where id = $1", [id]);
    expect((await db.query("select 1 from public.accounts where id = $1", [id])).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.profiles where username = 'leaving'")).rows).toHaveLength(0);
  });
});

describe("accounts access", () => {
  it("lets a user read only their own row", async () => {
    const rows = await runAs(db, asAlice(), (q) => q<{ id: string }>("select id from public.accounts"));
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it("gives anonymous visitors no access", async () => {
    await expect(runAs(db, anon, (q) => q("select * from public.accounts"))).rejects.toThrow(/permission denied/);
  });

  it("lets a user update their display name", async () => {
    const rows = await runAs(db, asAlice(), (q) =>
      q<{ display_name: string }>("update public.accounts set display_name = 'Al' where id = $1 returning display_name", [alice]),
    );
    expect(rows[0].display_name).toBe("Al");
  });

  it("does not let a user update someone else's account", async () => {
    const rows = await runAs(db, asAlice(), (q) =>
      q("update public.accounts set display_name = 'Hacked' where id = $1 returning id", [bob]),
    );
    expect(rows).toHaveLength(0);
  });

  it.each([
    ["status", "status = 'active'"],
    ["currency", "currency = 'USD'"],
    ["consent time", "terms_accepted_at = '2000-01-01'"],
    ["consent version", "terms_accepted_version = 'forged'"],
  ])("does not let a user change their own %s", async (_label, assignment) => {
    await expect(
      runAs(db, asAlice(), (q) => q(`update public.accounts set ${assignment} where id = $1`, [alice])),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let users insert or delete accounts directly", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("insert into public.accounts (id, display_name) values ($1, 'x')", [crypto.randomUUID()])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, asAlice(), (q) => q("delete from public.accounts where id = $1", [alice])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("profiles access", () => {
  it("does not expose the profiles table to anonymous visitors", async () => {
    await expect(runAs(db, anon, (q) => q("select * from public.profiles"))).rejects.toThrow(/permission denied/);
  });

  it("does not let a user read another user's profile row, even a published one", async () => {
    const rows = await runAs(db, asAlice(), (q) => q("select 1 from public.profiles where owner_id = $1", [bob]));
    expect(rows).toHaveLength(0);
  });

  it("does not let a user edit or delete another user's profile", async () => {
    const updated = await runAs(db, asAlice(), (q) =>
      q("update public.profiles set bio = 'hacked' where owner_id = $1 returning id", [bob]),
    );
    const deleted = await runAs(db, asAlice(), (q) =>
      q("delete from public.profiles where owner_id = $1 returning id", [bob]),
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("does not let a user create a profile for someone else", async () => {
    const fresh = await createUser(db);
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.profiles (owner_id, username, display_name) values ($1, 'stolen', 'x')", [fresh]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let a user transfer a profile to someone else", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("update public.profiles set owner_id = $1 where owner_id = $2", [bob, alice])),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let a user forge published_at", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("update public.profiles set published_at = now() where owner_id = $1", [alice])),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets a user publish and stamps published_at from the server", async () => {
    const rows = await runAs(db, asAlice(), (q) =>
      q<{ published_at: Date }>("update public.profiles set status = 'published' where owner_id = $1 returning published_at", [alice]),
    );
    expect(rows[0].published_at).toBeInstanceOf(Date);
  });

  it("limits an account to the configured number of profiles", async () => {
    await db.query("update public.platform_settings set value = '1' where key = 'max_profiles_per_account'");
    await expect(
      runAs(db, asAlice(), (q) =>
        q("insert into public.profiles (owner_id, username, display_name) values ($1, 'alice2', 'x')", [alice]),
      ),
    ).rejects.toThrow(/profile limit reached/);
    await db.query("update public.platform_settings set value = '5' where key = 'max_profiles_per_account'");
  });

  it("rejects usernames that differ only by case", async () => {
    const fresh = await createUser(db);
    await expect(
      runAs(db, { role: "authenticated", userId: fresh }, (q) =>
        q("insert into public.profiles (owner_id, username, display_name) values ($1, 'ALICE', 'x')", [fresh]),
      ),
    ).rejects.toThrow(/unique/);
  });

  it("rejects reserved and malformed usernames sent directly to the database", async () => {
    const fresh = await createUser(db);
    for (const username of ["admin", "fuck", "a b", "<script>", "-edge-", "double--dash", "ab"]) {
      await expect(
        runAs(db, { role: "authenticated", userId: fresh }, (q) =>
          q("insert into public.profiles (owner_id, username, display_name) values ($1, $2, 'x')", [fresh, username]),
        ),
        username,
      ).rejects.toThrow();
    }
  });
});

describe("suspension", () => {
  let target: string;

  beforeAll(async () => {
    target = await createUser(db, { username: "suspendee" });
    await db.query("update public.profiles set status = 'suspended' where owner_id = $1", [target]);
  });

  it("does not let a user lift their own suspension", async () => {
    await expect(
      runAs(db, { role: "authenticated", userId: target }, (q) =>
        q("update public.profiles set status = 'published' where owner_id = $1", [target]),
      ),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("does not let a user set suspended themselves", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("update public.profiles set status = 'suspended' where owner_id = $1", [alice])),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("does not let a user create a suspended profile", async () => {
    const fresh = await createUser(db);
    await expect(
      runAs(db, { role: "authenticated", userId: fresh }, (q) =>
        q("insert into public.profiles (owner_id, username, display_name, status) values ($1, 'freshname', 'x', 'suspended')", [fresh]),
      ),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("lets the service role suspend and restore", async () => {
    const rows = await runAs(db, service, (q) =>
      q<{ status: string }>("update public.profiles set status = 'unpublished' where owner_id = $1 returning status", [target]),
    );
    expect(rows[0].status).toBe("unpublished");
  });
});

describe("public_profiles view", () => {
  it("shows only published profiles to anonymous visitors", async () => {
    const rows = await runAs(db, anon, (q) => q<{ username: string }>("select username from public.public_profiles"));
    const names = rows.map((r) => r.username);
    expect(names).toContain("bob");
    expect(names).not.toContain("alice");
  });

  it("does not expose the owner's id", async () => {
    await expect(runAs(db, anon, (q) => q("select owner_id from public.public_profiles"))).rejects.toThrow(/owner_id/);
  });

  it("hides a published profile when its account is suspended", async () => {
    const id = await createUser(db, { username: "hiddenacct" });
    await db.query("update public.profiles set status = 'published' where owner_id = $1", [id]);
    await db.query("update public.accounts set status = 'suspended' where id = $1", [id]);
    const rows = await runAs(db, anon, (q) => q("select 1 from public.public_profiles where username = 'hiddenacct'"));
    expect(rows).toHaveLength(0);
  });

  it("cannot be written to through the view", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("update public.public_profiles set bio = 'x'")),
    ).rejects.toThrow(/permission denied|cannot update view/);
  });
});

describe("internal tables", () => {
  it.each(["reserved_usernames", "rate_limit_buckets"])("%s is closed to clients", async (table) => {
    await expect(runAs(db, anon, (q) => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, asAlice(), (q) => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
  });

  it("has row-level security enabled on every table in public", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("has no SECURITY DEFINER function with an unpinned search_path", async () => {
    const { rows } = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(rows).toEqual([]);
  });

  it("exposes to clients only the functions meant to be public", async () => {
    const { rows } = await db.query<{ proname: string; grantee: string }>(
      `select p.proname, g.grantee::regrole::text as grantee
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
       where n.nspname = 'public' and g.privilege_type = 'EXECUTE'
         and g.grantee in (0, 'anon'::regrole, 'authenticated'::regrole)`,
    );
    const byGrantee = (grantee: string) =>
      rows.filter((r) => r.grantee === grantee).map((r) => r.proname).sort();
    // is_valid_username_format stays open on purpose: it is pure, and CHECK constraints call it.
    expect(byGrantee("anon")).toEqual(["is_username_available", "is_valid_username_format", "resolve_custom_domain"]);
    expect(byGrantee("authenticated")).toEqual([
      "is_active_account",
      "is_admin",
      "is_username_available",
      "is_valid_username_format",
      "owns_profile",
      "record_consent",
      "reorder_blocks",
      "reorder_social_links",
      "resolve_custom_domain",
      "use_gallery_theme",
    ]);
  });
});

describe("admin roles", () => {
  it("does not let a user make themselves an admin", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("insert into public.admin_roles (user_id, role) values ($1, 'admin')", [alice])),
    ).rejects.toThrow(/permission denied/);
    const rows = await runAs(db, asAlice(), (q) => q<{ is_admin: boolean }>("select public.is_admin()"));
    expect(rows[0].is_admin).toBe(false);
  });

  it("recognises a role granted by the service role, and only for that user", async () => {
    const staff = await createUser(db);
    await runAs(db, service, (q) => q("insert into public.admin_roles (user_id, role) values ($1, 'admin')", [staff]), { commit: true });
    const asStaff = await runAs(db, { role: "authenticated", userId: staff }, (q) => q<{ is_admin: boolean }>("select public.is_admin()"));
    const asOther = await runAs(db, asBob(), (q) => q<{ is_admin: boolean }>("select public.is_admin()"));
    const seenByBob = await runAs(db, asBob(), (q) => q("select * from public.admin_roles"));
    expect(asStaff[0].is_admin).toBe(true);
    expect(asOther[0].is_admin).toBe(false);
    expect(seenByBob).toHaveLength(0);
  });
});

describe("audit log", () => {
  it("is append-only, even for the service role", async () => {
    const [row] = await runAs(db, service, (q) =>
      q<{ id: string }>("insert into public.audit_logs (action) values ('test.event') returning id"),
      { commit: true },
    );
    await expect(
      runAs(db, service, (q) => q("update public.audit_logs set action = 'x' where id = $1", [row.id])),
    ).rejects.toThrow(/permission denied|append-only/);
    await expect(
      runAs(db, service, (q) => q("delete from public.audit_logs where id = $1", [row.id])),
    ).rejects.toThrow(/permission denied|append-only/);
    await expect(db.query("delete from public.audit_logs")).rejects.toThrow(/append-only/);
    await expect(db.query("truncate public.audit_logs")).rejects.toThrow(/append-only/);
  });

  it("cannot be written by users or read by non-staff", async () => {
    await expect(
      runAs(db, asAlice(), (q) => q("insert into public.audit_logs (action) values ('forged')")),
    ).rejects.toThrow(/permission denied/);
    const rows = await runAs(db, asAlice(), (q) => q("select * from public.audit_logs"));
    expect(rows).toHaveLength(0);
  });

  it("outlives the deletion of its actor", async () => {
    const actor = await createUser(db);
    await db.query("insert into public.audit_logs (actor_id, action) values ($1, 'kept.event')", [actor]);
    await db.query("delete from auth.users where id = $1", [actor]);
    const { rows } = await db.query("select 1 from public.audit_logs where actor_id = $1", [actor]);
    expect(rows).toHaveLength(1);
  });
});

describe("rate limiting", () => {
  const limit = (key: string, max: number, windowSeconds = 60) =>
    runAs(db, service, (q) =>
      q<{ allowed: boolean; retry_after_seconds: number }>("select * from public.check_rate_limit($1, $2, $3)", [key, max, windowSeconds]),
      { commit: true },
    ).then((rows) => rows[0]);

  it("allows up to the limit and then blocks with a retry hint", async () => {
    expect(await limit("k1", 2)).toEqual({ allowed: true, retry_after_seconds: 0 });
    expect((await limit("k1", 2)).allowed).toBe(true);
    const blocked = await limit("k1", 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after_seconds).toBeGreaterThan(0);
    expect(blocked.retry_after_seconds).toBeLessThanOrEqual(60);
  });

  it("keeps keys independent", async () => {
    await limit("k2", 1);
    expect((await limit("k3", 1)).allowed).toBe(true);
  });

  it("starts a new window once the old one has passed", async () => {
    await limit("k4", 1);
    expect((await limit("k4", 1)).allowed).toBe(false);
    await db.query("update public.rate_limit_buckets set window_start = now() - interval '2 minutes' where bucket_key = 'k4'");
    expect((await limit("k4", 1)).allowed).toBe(true);
  });

  it("rejects nonsensical parameters", async () => {
    await expect(limit("k5", 0)).rejects.toThrow(/invalid rate limit/);
    await expect(limit("k5", 1, 100_000)).rejects.toThrow(/invalid rate limit/);
  });

  it("cannot be called by clients", async () => {
    await expect(
      runAs(db, anon, (q) => q("select * from public.check_rate_limit('x', 1, 1)")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, asAlice(), (q) => q("select * from public.check_rate_limit('x', 1, 1)")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("username availability", () => {
  const available = (name: string) =>
    runAs(db, anon, (q) => q<{ a: boolean }>("select public.is_username_available($1) as a", [name])).then((r) => r[0].a);

  it("reports free, taken, reserved, prohibited and malformed names", async () => {
    expect(await available("somebody-new")).toBe(true);
    expect(await available("alice")).toBe(false);
    expect(await available("ALICE")).toBe(false);
    expect(await available("admin")).toBe(false);
    expect(await available("fuck")).toBe(false);
    expect(await available("no way")).toBe(false);
  });
});

describe("consent", () => {
  it("records consent only for the caller, using the server's clock", async () => {
    const user = await createUser(db);
    const other = await createUser(db);
    await runAs(db, { role: "authenticated", userId: user }, (q) => q("select public.record_consent('v2', 'v2')"), { commit: true });
    const { rows } = await db.query<{ id: string; terms_accepted_version: string | null }>(
      "select id, terms_accepted_version from public.accounts where id = any($1)",
      [[user, other]],
    );
    expect(rows.find((r) => r.id === user)?.terms_accepted_version).toBe("v2");
    expect(rows.find((r) => r.id === other)?.terms_accepted_version).toBeNull();
  });

  it("is not callable anonymously", async () => {
    await expect(runAs(db, anon, (q) => q("select public.record_consent('v', 'v')"))).rejects.toThrow(/permission denied/);
  });
});
