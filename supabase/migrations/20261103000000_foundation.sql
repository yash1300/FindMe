-- FindMe foundation schema: accounts, profiles, usernames, roles, audit log, rate limiting.
--
-- Security model: the anon key is public, so every rule here must hold even when a
-- client calls PostgREST directly and skips the application entirely.
--
-- Supabase's default privileges grant anon and authenticated access to new tables and
-- functions in `public`, so each object below revokes those explicitly and re-grants
-- only what is needed. Revoking from PUBLIC alone would not be enough.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.account_status as enum ('active', 'suspended');
create type public.profile_status as enum ('draft', 'published', 'unpublished', 'suspended');
create type public.reserved_username_kind as enum ('reserved', 'prohibited');
create type public.admin_role as enum ('admin', 'moderator');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Must stay in step with usernameFormatSchema in src/features/usernames/schema.ts.
-- Left executable by everyone: it is pure, and CHECK constraints call it as the current user.
create function public.is_valid_username_format(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username is not null
    and char_length(p_username) between 3 and 30
    and p_username ~ '^[a-z0-9]+([_-][a-z0-9]+)*$';
$$;

-- ---------------------------------------------------------------------------
-- accounts: one row per auth.users row
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  status public.account_status not null default 'active',
  terms_accepted_version text check (char_length(terms_accepted_version) <= 32),
  terms_accepted_at timestamptz,
  privacy_accepted_version text check (char_length(privacy_accepted_version) <= 32),
  privacy_accepted_at timestamptz,
  locale text not null default 'en-IN' check (char_length(locale) between 2 and 35),
  timezone text not null default 'Asia/Kolkata' check (char_length(timezone) between 1 and 64),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

revoke all on public.accounts from public, anon, authenticated;
grant select on public.accounts to authenticated;
-- status and the consent columns are deliberately not user-writable.
grant update (display_name, locale, timezone) on public.accounts to authenticated;
grant all on public.accounts to service_role;

create policy "accounts: owner can read"
  on public.accounts for select to authenticated
  using (id = auth.uid());

create policy "accounts: owner can update"
  on public.accounts for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- reserved_usernames: routes, brand and role names, and prohibited terms
-- ---------------------------------------------------------------------------

create table public.reserved_usernames (
  name text primary key check (name = lower(name)),
  kind public.reserved_username_kind not null
);

alter table public.reserved_usernames enable row level security;

revoke all on public.reserved_usernames from public, anon, authenticated;
grant all on public.reserved_usernames to service_role;

-- Must stay in step with src/features/usernames/reserved.ts; a test compares the two.
insert into public.reserved_usernames (name, kind)
select unnest(array[
  -- Current and planned application routes
  'about', 'account', 'accounts', 'admin', 'api', 'app', 'auth', 'billing', 'blog', 'callback',
  'contact', 'dashboard', 'docs', 'examples', 'faq', 'features', 'forgot-password', 'help',
  'home', 'integrations', 'login', 'logout', 'manifest', 'onboarding', 'pricing', 'privacy',
  'register', 'reset-password', 'robots', 'settings', 'signin', 'signout', 'signup', 'sitemap',
  'static', 'status', 'support', 'suspended', 'terms', 'themes', 'verify-email', 'www',
  -- Brand and trust-sensitive names
  'abuse', 'administrator', 'billing-support', 'findme', 'find-me', 'findme-official',
  'findme-support', 'helpdesk', 'info', 'legal', 'moderator', 'official', 'owner', 'postmaster',
  'root', 'security', 'staff', 'system', 'team', 'verified', 'webmaster'
]), 'reserved'::public.reserved_username_kind
union all
select unnest(array[
  'asshole', 'bastard', 'bitch', 'cunt', 'fuck', 'hitler', 'nazi', 'nigger', 'porn', 'rape',
  'shit', 'slut', 'whore'
]), 'prohibited'::public.reserved_username_kind;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts (id) on delete cascade,
  -- Always stored lowercase, which is what makes uniqueness case-insensitive.
  username text not null unique check (public.is_valid_username_format(username)),
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text check (char_length(bio) <= 300),
  avatar_path text check (char_length(avatar_path) <= 512),
  cover_path text check (char_length(cover_path) <= 512),
  category text check (char_length(category) <= 64),
  status public.profile_status not null default 'draft',
  theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_owner_id_idx on public.profiles (owner_id);
create index profiles_published_idx on public.profiles (updated_at desc) where status = 'published';

-- Lowercases input and rejects reserved names. DEFINER because reserved_usernames is unreadable to users.
create function public.validate_profile_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.username := lower(btrim(new.username));
  if exists (select 1 from public.reserved_usernames r where r.name = new.username) then
    raise exception 'username is not available' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- INVOKER on purpose: current_user must be the real caller.
create function public.guard_profile_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin');
begin
  if not v_privileged then
    if tg_op = 'INSERT' and new.status = 'suspended' then
      raise exception 'profile status cannot be changed' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.status is distinct from new.status
       and 'suspended' in (old.status, new.status) then
      raise exception 'profile status cannot be changed' using errcode = '42501';
    end if;
  end if;

  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  return new;
end;
$$;

-- One profile per account until entitlements arrive in Phase 5, which will replace this constant.
-- The advisory lock stops two concurrent inserts from both passing the count.
create function public.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  if (select count(*) from public.profiles p where p.owner_id = new.owner_id) >= 1 then
    raise exception 'profile limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_a_validate_username
  before insert or update of username on public.profiles
  for each row execute function public.validate_profile_username();

create trigger profiles_b_guard_status
  before insert or update on public.profiles
  for each row execute function public.guard_profile_status();

create trigger profiles_c_enforce_limit
  before insert on public.profiles
  for each row execute function public.enforce_profile_limit();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select, delete on public.profiles to authenticated;
grant insert (owner_id, username, display_name, bio, avatar_path, cover_path, category, status, theme)
  on public.profiles to authenticated;
-- owner_id and published_at are deliberately not updatable by users.
grant update (username, display_name, bio, avatar_path, cover_path, category, status, theme)
  on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- There is intentionally no public read policy. Everyone else uses public_profiles below,
-- so owner_id and drafts can never leak through this table.
create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (owner_id = auth.uid());

create policy "profiles: owner can insert"
  on public.profiles for insert to authenticated
  with check (owner_id = auth.uid());

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "profiles: owner can delete"
  on public.profiles for delete to authenticated
  using (owner_id = auth.uid());

-- Runs with its owner's rights on purpose: this is the one safe public window onto profiles.
create view public.public_profiles
with (security_barrier = true)
as
  select
    p.id, p.username, p.display_name, p.bio, p.avatar_path, p.cover_path,
    p.category, p.theme, p.published_at, p.updated_at
  from public.profiles p
  join public.accounts a on a.id = p.owner_id
  where p.status = 'published' and a.status = 'active';

revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_roles
-- ---------------------------------------------------------------------------

create table public.admin_roles (
  user_id uuid primary key references public.accounts (id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

revoke all on public.admin_roles from public, anon, authenticated;
grant select on public.admin_roles to authenticated;
grant all on public.admin_roles to service_role;

create policy "admin_roles: user can read own role"
  on public.admin_roles for select to authenticated
  using (user_id = auth.uid());

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_roles r where r.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately not a foreign key, so the history outlives account deletion.
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 128),
  target_type text check (char_length(target_type) <= 64),
  target_id text check (char_length(target_id) <= 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);

create function public.reject_audit_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.reject_audit_log_change();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.reject_audit_log_change();

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from public, anon, authenticated, service_role;
grant select on public.audit_logs to authenticated;
grant select, insert on public.audit_logs to service_role;

create policy "audit_logs: staff can read"
  on public.audit_logs for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- rate_limit_buckets
-- ---------------------------------------------------------------------------

create table public.rate_limit_buckets (
  bucket_key text primary key check (char_length(bucket_key) <= 200),
  window_start timestamptz not null,
  count integer not null
);

create index rate_limit_buckets_window_start_idx on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;

revoke all on public.rate_limit_buckets from public, anon, authenticated;
grant all on public.rate_limit_buckets to service_role;

-- Atomic fixed-window counter. The upsert's row lock serialises concurrent callers.
create function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
  v_count integer;
  v_start timestamptz;
begin
  if p_limit < 1 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;
  v_window := make_interval(secs => p_window_seconds);

  insert into public.rate_limit_buckets as b (bucket_key, window_start, count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update set
    count = case when b.window_start + v_window <= now() then 1 else b.count + 1 end,
    window_start = case when b.window_start + v_window <= now() then now() else b.window_start end
  returning b.count, b.window_start into v_count, v_start;

  -- Windows are capped at a day, so anything older is dead. Pruned on about 1% of calls.
  if random() < 0.01 then
    delete from public.rate_limit_buckets where window_start < now() - interval '1 day';
  end if;

  allowed := v_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (v_start + v_window - now())))::integer)
  end;
  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Public and user-facing functions
-- ---------------------------------------------------------------------------

create function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_valid_username_format(lower(btrim(p_username)))
    and not exists (select 1 from public.reserved_usernames r where r.name = lower(btrim(p_username)))
    and not exists (select 1 from public.profiles p where p.username = lower(btrim(p_username)));
$$;

revoke all on function public.is_username_available(text) from public, anon, authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated, service_role;

-- Consent timestamps always come from the server's clock, never from the client.
create function public.record_consent(p_terms_version text, p_privacy_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.accounts
  set terms_accepted_version = p_terms_version,
      terms_accepted_at = now(),
      privacy_accepted_version = p_privacy_version,
      privacy_accepted_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.record_consent(text, text) from public, anon, authenticated;
grant execute on function public.record_consent(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- New user provisioning
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := left(btrim(coalesce(v_meta ->> 'display_name', v_meta ->> 'full_name', v_meta ->> 'name', '')), 80);
  v_username text := lower(btrim(coalesce(v_meta ->> 'username', '')));
  -- Metadata is client-supplied, so over-long versions are dropped rather than trusted.
  v_terms text := nullif(left(coalesce(v_meta ->> 'terms_version', ''), 32), '');
  v_privacy text := nullif(left(coalesce(v_meta ->> 'privacy_version', ''), 32), '');
begin
  -- Never fall back to the email address: display names can become public.
  if v_name = '' then
    v_name := 'FindMe creator';
  end if;

  insert into public.accounts (
    id, display_name,
    terms_accepted_version, terms_accepted_at,
    privacy_accepted_version, privacy_accepted_at
  )
  values (
    new.id, v_name,
    v_terms, case when v_terms is not null then now() end,
    v_privacy, case when v_privacy is not null then now() end
  );

  -- A lost username race or invalid name must not fail the whole signup:
  -- the user simply picks another name during onboarding.
  if v_username <> '' then
    begin
      insert into public.profiles (owner_id, username, display_name)
      values (new.id, v_username, v_name);
    exception
      when unique_violation or check_violation then
        null;
    end;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions cannot be invoked through RPC, but leave nothing to chance.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_profile_username() from public, anon, authenticated;
revoke all on function public.guard_profile_status() from public, anon, authenticated;
revoke all on function public.enforce_profile_limit() from public, anon, authenticated;
revoke all on function public.reject_audit_log_change() from public, anon, authenticated;
