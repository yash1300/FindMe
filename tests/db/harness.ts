import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * The parts of a Supabase database our migrations depend on. The default privileges
 * mirror Supabase's own grants, so a table or function that forgets to revoke access is
 * exposed here exactly as it would be in production.
 */
const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb
  );

  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null
  );
  alter table storage.objects enable row level security;
  grant select, insert, delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type TestDb = PGlite;

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

export type Actor =
  | { role: "anon" }
  | { role: "service_role" }
  | { role: "authenticated"; userId: string };

/**
 * Runs a callback as the given actor, the same way PostgREST does. The transaction is
 * rolled back afterwards unless `commit` is set, and failures propagate to the caller.
 */
export async function runAs<T>(
  db: TestDb,
  actor: Actor,
  fn: (query: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    const sub = actor.role === "authenticated" ? actor.userId : "";
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    await tx.exec(`set local role ${actor.role}`);
    const result = await fn(async <R,>(sql: string, params: unknown[] = []) => {
      const res = await tx.query<R>(sql, params);
      return res.rows;
    });
    await tx.exec("reset role");
    if (!commit) await tx.rollback();
    return result;
  }) as Promise<T>;
}

export async function createUser(
  db: TestDb,
  metadata: Record<string, unknown> = {},
  email = `${crypto.randomUUID()}@example.test`,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(metadata)],
  );
  return rows[0].id;
}
