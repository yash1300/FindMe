import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, runAs, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;
let staff: string;

const as = (userId: string) => ({ role: "authenticated", userId }) as const;
const THEME = JSON.stringify({ preset: "modern" });

const share = (owner: string, name = "Sunset", commit = true) =>
  runAs(db, as(owner), (q) => q<{ id: string }>("insert into public.shared_themes (owner_id, name, theme) values ($1, $2, $3) returning id", [owner, name, THEME]), { commit });

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, { username: "alice" });
  bob = await createUser(db, { username: "bob" });
  staff = await createUser(db, { username: "staffer" });
  await db.query("insert into public.admin_roles (user_id, role) values ($1, 'moderator')", [staff]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("theme gallery", () => {
  it("lets a creator share a theme, which others see without the creator's identity", async () => {
    const [{ id }] = await share(alice);
    const rows = await runAs(db, as(bob), (q) => q("select * from public.gallery_themes where id = $1", [id]));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["created_at", "id", "name", "theme", "use_count"]);
  });

  it("keeps the table itself private to each owner, and the gallery from anonymous visitors", async () => {
    expect(await runAs(db, as(bob), (q) => q("select 1 from public.shared_themes where owner_id = $1", [alice]))).toHaveLength(0);
    await expect(runAs(db, { role: "anon" }, (q) => q("select 1 from public.gallery_themes"))).rejects.toThrow(/permission denied/);
  });

  it("won't let anyone share as someone else, or set their own status or use count", async () => {
    await expect(
      runAs(db, as(bob), (q) => q("insert into public.shared_themes (owner_id, name, theme) values ($1, 'Fake', $2)", [alice, THEME])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      runAs(db, as(bob), (q) => q("insert into public.shared_themes (owner_id, name, theme, use_count) values ($1, 'Pumped', $2, 999)", [bob, THEME])),
    ).rejects.toThrow(/permission denied/);
    await expect(runAs(db, as(alice), (q) => q("update public.shared_themes set use_count = 999 where owner_id = $1", [alice]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("counts uses by others, but not by the theme's own creator", async () => {
    const [{ id }] = await share(alice, "Counted");
    await runAs(db, as(bob), (q) => q("select public.use_gallery_theme($1)", [id]), { commit: true });
    await runAs(db, as(alice), (q) => q("select public.use_gallery_theme($1)", [id]), { commit: true });
    const { rows } = await db.query<{ use_count: number }>("select use_count from public.shared_themes where id = $1", [id]);
    expect(rows[0].use_count).toBe(1);
  });

  it("caps each creator at 10 shared themes", async () => {
    const owner = await createUser(db, { username: "prolific" });
    for (let i = 0; i < 10; i += 1) await share(owner, `Theme ${i}`);
    await expect(share(owner, "Eleventh", false)).rejects.toThrow(/shared theme limit/);
  });

  it("hides a suspended creator's themes, and lets staff remove one with a logged reason", async () => {
    const [{ id }] = await share(bob, "Removable");
    await db.query("update public.accounts set status = 'suspended' where id = $1", [bob]);
    expect(await runAs(db, as(alice), (q) => q("select 1 from public.gallery_themes where id = $1", [id]))).toHaveLength(0);
    await db.query("update public.accounts set status = 'active' where id = $1", [bob]);

    await expect(db.query("select public.admin_remove_shared_theme($1, $2, 'spam')", [alice, id])).rejects.toThrow(/not allowed/);
    await db.query("select public.admin_remove_shared_theme($1, $2, 'Offensive name')", [staff, id]);
    expect(await runAs(db, as(alice), (q) => q("select 1 from public.gallery_themes where id = $1", [id]))).toHaveLength(0);
    await expect(runAs(db, as(alice), (q) => q("select public.use_gallery_theme($1)", [id]))).rejects.toThrow(/theme not found/);
    const { rows } = await db.query("select 1 from public.audit_logs where action = 'theme.removed' and target_id = $1", [id]);
    expect(rows).toHaveLength(1);
  });
});
