import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, runAs, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;
let admin: string;
let moderator: string;
let bobProfile: string;

const anon = { role: "anon" } as const;
const service = { role: "service_role" } as const;
const as = (userId: string) => ({ role: "authenticated", userId }) as const;

async function profileOf(owner: string) {
  const { rows } = await db.query<{ id: string }>("select id from public.profiles where owner_id = $1 order by created_at limit 1", [owner]);
  return rows[0].id;
}

const callService = (sql: string, params: unknown[]) => runAs(db, service, (q) => q(sql, params), { commit: true });
const auditCount = async (action: string) =>
  (await db.query("select 1 from public.audit_logs where action = $1", [action])).rows.length;

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, { username: "alice" });
  bob = await createUser(db, { username: "bob" });
  admin = await createUser(db, { username: "theadmin" });
  moderator = await createUser(db, { username: "themod" });
  bobProfile = await profileOf(bob);
  await db.query("insert into public.admin_roles (user_id, role) values ($1, 'admin'), ($2, 'moderator')", [admin, moderator]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("multiple profiles", () => {
  const add = (owner: string, username: string) =>
    runAs(db, as(owner), (q) =>
      q("insert into public.profiles (owner_id, username, display_name, onboarding_completed_at) values ($1, $2, 'x', now()) returning id", [owner, username]),
    { commit: true });

  it("lets an account have several pages, up to the configured limit", async () => {
    const owner = await createUser(db, { username: "multi1" });
    for (const name of ["multi2", "multi3", "multi4", "multi5"]) await add(owner, name);
    await expect(add(owner, "multi6")).rejects.toThrow(/profile limit reached/);
  });

  it("reads the limit from settings", async () => {
    const owner = await createUser(db, { username: "limited1" });
    await db.query("update public.platform_settings set value = '1' where key = 'max_profiles_per_account'");
    await expect(add(owner, "limited2")).rejects.toThrow(/profile limit reached/);
    await db.query("update public.platform_settings set value = '5' where key = 'max_profiles_per_account'");
    await expect(add(owner, "limited2")).resolves.toBeDefined();
  });

  it("still doesn't let anyone create a page for someone else", async () => {
    await expect(
      runAs(db, as(alice), (q) =>
        q("insert into public.profiles (owner_id, username, display_name) values ($1, 'stolen2', 'x')", [bob]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("custom domains", () => {
  let aliceProfile: string;

  beforeAll(async () => {
    aliceProfile = await profileOf(alice);
    await db.query("update public.profiles set status = 'published' where id = $1", [aliceProfile]);
  });

  const addDomain = (user: string, profile: string, hostname: string) =>
    runAs(db, as(user), (q) =>
      q<{ id: string; verification_token: string; status: string }>(
        "insert into public.custom_domains (profile_id, hostname) values ($1, $2) returning id, verification_token, status",
        [profile, hostname],
      ),
    { commit: true });

  it("adds a domain as pending, with a long random token", async () => {
    const [row] = await addDomain(alice, aliceProfile, "alice.example.com");
    expect(row.status).toBe("pending");
    expect(row.verification_token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("doesn't let the same domain be claimed twice", async () => {
    await expect(addDomain(bob, bobProfile, "alice.example.com")).rejects.toThrow(/unique/);
  });

  it.each(["not a domain", "UPPER.example.com", "localhost", "http://x.com", "a..b.com", "-bad.example.com", "x.com/path"])(
    "rejects %s",
    async (hostname) => {
      await expect(addDomain(alice, aliceProfile, hostname)).rejects.toThrow(/check/);
    },
  );

  it("doesn't let a user add a domain to someone else's page, or see theirs", async () => {
    await expect(addDomain(alice, bobProfile, "attack.example.com")).rejects.toThrow(/row-level security/);
    expect(await runAs(db, as(bob), (q) => q("select * from public.custom_domains where hostname = 'alice.example.com'"))).toHaveLength(0);
  });

  it("doesn't let a user mark their own domain as verified", async () => {
    await expect(
      runAs(db, as(alice), (q) => q("update public.custom_domains set status = 'active' where hostname = 'alice.example.com'")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      runAs(db, as(alice), (q) => q("insert into public.custom_domains (profile_id, hostname, status) values ($1, 'forced.example.com', 'active')", [aliceProfile])),
    ).rejects.toThrow(/permission denied/);
  });

  const resolve = (host: string) =>
    runAs(db, anon, (q) => q<{ u: string | null }>("select public.resolve_custom_domain($1) as u", [host])).then((r) => r[0].u);

  it("resolves only when active, and only for a live page", async () => {
    expect(await resolve("alice.example.com")).toBeNull();
    await db.query("update public.custom_domains set status = 'active' where hostname = 'alice.example.com'");
    expect(await resolve("ALICE.example.com")).toBe("alice");

    await db.query("update public.profiles set status = 'unpublished' where id = $1", [aliceProfile]);
    expect(await resolve("alice.example.com")).toBeNull();
    await db.query("update public.profiles set status = 'published' where id = $1", [aliceProfile]);

    await db.query("update public.accounts set status = 'suspended' where id = $1", [alice]);
    expect(await resolve("alice.example.com")).toBeNull();
    await db.query("update public.accounts set status = 'active' where id = $1", [alice]);
  });

  it("is closed to anonymous visitors, apart from resolving", async () => {
    await expect(runAs(db, anon, (q) => q("select * from public.custom_domains"))).rejects.toThrow(/permission denied/);
  });
});

describe("admin actions", () => {
  it("suspends and restores an account, logging both in the same transaction", async () => {
    const target = await createUser(db, { username: "suspendme" });
    await callService("select public.admin_set_account_status($1, $2, 'suspended', 'spam')", [moderator, target]);
    const status = async () => (await db.query<{ status: string }>("select status from public.accounts where id = $1", [target])).rows[0].status;
    expect(await status()).toBe("suspended");
    expect(await auditCount("account.suspended")).toBeGreaterThan(0);

    await callService("select public.admin_set_account_status($1, $2, 'active', 'appealed')", [admin, target]);
    expect(await status()).toBe("active");
    const { rows } = await db.query("select 1 from public.moderation_actions where target_id = $1", [target]);
    expect(rows).toHaveLength(2);
  });

  it("refuses non-staff, and changes and logs nothing", async () => {
    const before = await auditCount("account.suspended");
    await expect(callService("select public.admin_set_account_status($1, $2, 'suspended', 'x')", [alice, bob])).rejects.toThrow(/not allowed/);
    expect((await db.query<{ status: string }>("select status from public.accounts where id = $1", [bob])).rows[0].status).toBe("active");
    expect(await auditCount("account.suspended")).toBe(before);
  });

  it("logs nothing when the change fails", async () => {
    const before = await auditCount("account.suspended");
    await expect(callService("select public.admin_set_account_status($1, $2, 'suspended', 'x')", [admin, crypto.randomUUID()])).rejects.toThrow(/not found/);
    expect(await auditCount("account.suspended")).toBe(before);
  });

  it("doesn't let staff suspend themselves or each other", async () => {
    await expect(callService("select public.admin_set_account_status($1, $2, 'suspended', 'x')", [admin, admin])).rejects.toThrow(/own account/);
    await expect(callService("select public.admin_set_account_status($1, $2, 'suspended', 'x')", [moderator, admin])).rejects.toThrow(/staff role/);
  });

  it("suspends a page, which its owner can't undo, and restores it as unpublished", async () => {
    const target = await createUser(db, { username: "badpage" });
    const profile = await profileOf(target);
    await db.query("update public.profiles set status = 'published' where id = $1", [profile]);

    await callService("select public.admin_set_profile_suspended($1, $2, true, 'scam')", [moderator, profile]);
    await expect(
      runAs(db, as(target), (q) => q("update public.profiles set status = 'published' where id = $1", [profile])),
    ).rejects.toThrow(/cannot be changed/);

    await callService("select public.admin_set_profile_suspended($1, $2, false, 'fixed')", [admin, profile]);
    expect((await db.query<{ status: string }>("select status from public.profiles where id = $1", [profile])).rows[0].status).toBe("unpublished");
  });

  it("hides a reported link", async () => {
    const { rows } = await db.query<{ id: string }>("insert into public.blocks (profile_id, type, config) values ($1, 'link', $2) returning id", [
      bobProfile,
      JSON.stringify({ title: "bad", url: "https://example.com" }),
    ]);
    await callService("select public.admin_hide_block($1, $2, 'phishing')", [moderator, rows[0].id]);
    expect((await db.query<{ is_visible: boolean }>("select is_visible from public.blocks where id = $1", [rows[0].id])).rows[0].is_visible).toBe(false);
    expect(await auditCount("block.hidden")).toBeGreaterThan(0);
  });

  it("closes a report once only", async () => {
    const { rows } = await db.query<{ id: string }>("insert into public.reports (username_snapshot, reason) values ('bob', 'spam') returning id");
    await callService("select public.admin_close_report($1, $2, 'dismissed', 'not spam')", [moderator, rows[0].id]);
    await expect(callService("select public.admin_close_report($1, $2, 'resolved', 'again')", [moderator, rows[0].id])).rejects.toThrow(/already closed/);
  });

  it("lets admins, but not moderators, change settings, and logs old and new values", async () => {
    await expect(callService("select public.admin_update_setting($1, 'announcement', $2)", [moderator, JSON.stringify("hi")])).rejects.toThrow(/not allowed/);
    await callService("select public.admin_update_setting($1, 'announcement', $2)", [admin, JSON.stringify("Hello")]);
    const { rows } = await db.query<{ metadata: { new: string } }>("select metadata from public.audit_logs where action = 'setting.updated' order by created_at desc limit 1");
    expect(rows[0].metadata.new).toBe("Hello");
  });

  it.each([
    ["admin_set_account_status", "$1::uuid, $1::uuid, 'suspended', 'x'"],
    ["admin_set_profile_suspended", "$1::uuid, $1::uuid, true, 'x'"],
    ["admin_hide_block", "$1::uuid, $1::uuid, 'x'"],
    ["admin_close_report", "$1::uuid, $1::uuid, 'resolved', 'x'"],
    ["admin_update_setting", "$1::uuid, 'announcement', '\"x\"'"],
    ["require_staff", "$1::uuid"],
  ])("doesn't let clients call %s, even staff claiming to be an admin", async (fn, args) => {
    const sql = `select public.${fn}(${args})`;
    await expect(runAs(db, anon, (q) => q(sql, [admin]))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, as(alice), (q) => q(sql, [admin]))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, as(admin), (q) => q(sql, [admin]))).rejects.toThrow(/permission denied/);
  });
});

describe("closed tables", () => {
  it.each(["reports", "moderation_actions"])("%s is closed to clients", async (table) => {
    await expect(runAs(db, anon, (q) => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, as(admin), (q) => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
  });

  it("doesn't let users change settings", async () => {
    await expect(runAs(db, as(admin), (q) => q("update public.platform_settings set value = '99'"))).rejects.toThrow(/permission denied/);
    await expect(runAs(db, anon, (q) => q("select * from public.platform_settings"))).rejects.toThrow(/permission denied/);
    expect(await runAs(db, as(alice), (q) => q("select * from public.platform_settings"))).toHaveLength(2);
  });
});

describe("account deletion", () => {
  it("removes pages, domains and content, keeping the audit trail and reports", async () => {
    const owner = await createUser(db, { username: "leaver" });
    const profile = await profileOf(owner);
    await db.query("insert into public.custom_domains (profile_id, hostname) values ($1, 'leaver.example.com')", [profile]);
    const report = await db.query<{ id: string }>("insert into public.reports (profile_id, username_snapshot, reason) values ($1, 'leaver', 'spam') returning id", [profile]);
    await db.query("insert into public.leads (profile_id, kind, email, consent_text) values ($1, 'newsletter', 'fan@example.test', 'yes')", [profile]);
    await callService("select public.admin_set_account_status($1, $2, 'suspended', 'test')", [admin, owner]);

    await db.query("delete from auth.users where id = $1", [owner]);

    expect((await db.query("select 1 from public.custom_domains where hostname = 'leaver.example.com'")).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.leads where email = 'fan@example.test'")).rows).toHaveLength(0);
    expect((await db.query<{ profile_id: string | null }>("select profile_id from public.reports where id = $1", [report.rows[0].id])).rows[0].profile_id).toBeNull();
    expect((await db.query("select 1 from public.audit_logs where target_id = $1", [owner])).rows).toHaveLength(1);
  });
});
