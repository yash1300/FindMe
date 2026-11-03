-- Page content: blocks, social links, media storage, leads, contact submissions,
-- safer username changes, optimistic concurrency, and write lockout for suspended accounts.
--
-- Same rule as the foundation migration: everything must hold when a client calls PostgREST
-- directly, and new objects explicitly revoke Supabase's default grants.

-- ---------------------------------------------------------------------------
-- Suspended accounts lose write access
-- ---------------------------------------------------------------------------

create function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.accounts a where a.id = auth.uid() and a.status = 'active');
$$;

revoke all on function public.is_active_account() from public, anon, authenticated;
grant execute on function public.is_active_account() to authenticated, service_role;

drop policy "accounts: owner can update" on public.accounts;
create policy "accounts: active owner can update"
  on public.accounts for update to authenticated
  using (id = auth.uid() and public.is_active_account())
  with check (id = auth.uid());

drop policy "profiles: owner can insert" on public.profiles;
create policy "profiles: active owner can insert"
  on public.profiles for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_account());

drop policy "profiles: owner can update" on public.profiles;
create policy "profiles: active owner can update"
  on public.profiles for update to authenticated
  using (owner_id = auth.uid() and public.is_active_account())
  with check (owner_id = auth.uid());

drop policy "profiles: owner can delete" on public.profiles;
create policy "profiles: active owner can delete"
  on public.profiles for delete to authenticated
  using (owner_id = auth.uid() and public.is_active_account());

-- True when the caller may modify this profile's content.
create function public.owns_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.accounts a on a.id = p.owner_id
    where p.id = p_profile_id and p.owner_id = auth.uid() and a.status = 'active'
  );
$$;

revoke all on function public.owns_profile(uuid) from public, anon, authenticated;
grant execute on function public.owns_profile(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles: new columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column version bigint not null default 1,
  add column is_indexable boolean not null default true,
  add column onboarding_completed_at timestamptz,
  add column username_changed_at timestamptz;

-- Accounts that existed before the wizard shouldn't be sent through it.
update public.profiles set onboarding_completed_at = now();

grant update (is_indexable, onboarding_completed_at) on public.profiles to authenticated;

-- Lets the editor detect that a profile's content changed elsewhere instead of silently
-- overwriting it. Publishing and renaming don't count: they can't lose anyone's edits, and
-- counting them would make an open editor report a false conflict.
create function public.bump_profile_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.display_name, new.bio, new.avatar_path, new.cover_path, new.category, new.theme, new.is_indexable)
     is distinct from
     (old.display_name, old.bio, old.avatar_path, old.cover_path, old.category, old.theme, old.is_indexable) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;

create trigger profiles_z_bump_version
  before update on public.profiles
  for each row execute function public.bump_profile_version();

-- ---------------------------------------------------------------------------
-- Username changes
-- ---------------------------------------------------------------------------

-- A released name stays held for its former owner for 30 days, so that nobody can
-- immediately claim it and impersonate them to people following old links.
create table public.username_history (
  username text primary key,
  profile_id uuid references public.profiles (id) on delete set null,
  released_at timestamptz not null default now()
);

create index username_history_released_at_idx on public.username_history (released_at);

alter table public.username_history enable row level security;
revoke all on public.username_history from public, anon, authenticated;
grant all on public.username_history to service_role;

create or replace function public.validate_profile_username()
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
  if exists (
    select 1 from public.username_history h
    where h.username = new.username
      and h.released_at > now() - interval '30 days'
      and h.profile_id is distinct from new.id
  ) then
    raise exception 'username is not available' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- DEFINER because username_history is closed to clients. Server-side callers have no auth.uid().
create function public.guard_username_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username = old.username then
    return new;
  end if;

  -- One rename a day stops a user from cycling through names to hold many of them.
  if auth.uid() is not null
     and old.username_changed_at is not null
     and old.username_changed_at > now() - interval '1 day' then
    raise exception 'username was changed recently' using errcode = 'P0002';
  end if;

  insert into public.username_history (username, profile_id, released_at)
  values (old.username, old.id, now())
  on conflict (username) do update
    set profile_id = excluded.profile_id, released_at = excluded.released_at;

  new.username_changed_at := now();
  return new;
end;
$$;

create trigger profiles_ab_guard_username_change
  before update of username on public.profiles
  for each row execute function public.guard_username_change();

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_valid_username_format(lower(btrim(p_username)))
    and not exists (select 1 from public.reserved_usernames r where r.name = lower(btrim(p_username)))
    and not exists (select 1 from public.profiles p where p.username = lower(btrim(p_username)))
    and not exists (
      select 1 from public.username_history h
      where h.username = lower(btrim(p_username)) and h.released_at > now() - interval '30 days'
    );
$$;

-- ---------------------------------------------------------------------------
-- Public profile view gains indexing control
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_barrier = true)
as
  select
    p.id, p.username, p.display_name, p.bio, p.avatar_path, p.cover_path,
    p.category, p.theme, p.published_at, p.updated_at, p.is_indexable
  from public.profiles p
  join public.accounts a on a.id = p.owner_id
  where p.status = 'published' and a.status = 'active';

-- ---------------------------------------------------------------------------
-- blocks: everything on a page, including links
-- ---------------------------------------------------------------------------

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'link', 'social_icons', 'heading', 'text', 'image', 'youtube', 'video', 'spotify', 'soundcloud',
    'contact_info', 'email_button', 'phone_button', 'divider', 'announcement', 'featured_link',
    'product_card', 'newsletter', 'contact_form'
  )),
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 16384),
  position integer not null default 0,
  is_visible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A last line of defence: the application validates fully, but nothing may ever store a
  -- javascript: or data: URL, whatever route the write took.
  constraint blocks_url_scheme check (
    (not config ? 'url' or config ->> 'url' ~* '^https?://[^[:space:]]+$')
    and (not config ? 'linkUrl' or config ->> 'linkUrl' ~* '^https?://[^[:space:]]+$')
  ),
  constraint blocks_schedule_order check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index blocks_profile_position_idx on public.blocks (profile_id, position);

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

-- Appends new blocks, and caps them per profile so that one page can't grow without limit.
create function public.prepare_new_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_max integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 1));
  select count(*), coalesce(max(position), -1) into v_count, v_max
  from public.blocks where profile_id = new.profile_id;
  if v_count >= 200 then
    raise exception 'block limit reached' using errcode = 'P0001';
  end if;
  new.position := v_max + 1;
  return new;
end;
$$;

create trigger blocks_prepare_new
  before insert on public.blocks
  for each row execute function public.prepare_new_block();

alter table public.blocks enable row level security;

revoke all on public.blocks from public, anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (profile_id, type, config, is_visible, starts_at, ends_at) on public.blocks to authenticated;
-- position only changes through reorder_blocks, and profile_id and type never change.
grant update (config, is_visible, starts_at, ends_at) on public.blocks to authenticated;
grant all on public.blocks to service_role;

create policy "blocks: owner can read"
  on public.blocks for select to authenticated
  using (profile_id in (select id from public.profiles where owner_id = auth.uid()));

create policy "blocks: active owner can insert"
  on public.blocks for insert to authenticated
  with check (public.owns_profile(profile_id));

create policy "blocks: active owner can update"
  on public.blocks for update to authenticated
  using (public.owns_profile(profile_id))
  with check (public.owns_profile(profile_id));

create policy "blocks: active owner can delete"
  on public.blocks for delete to authenticated
  using (public.owns_profile(profile_id));

-- The only public window onto blocks. Hidden, unscheduled and expired content never leaves the database.
create view public.public_blocks
with (security_barrier = true)
as
  select b.id, b.profile_id, b.type, b.config, b.position
  from public.blocks b
  join public.profiles p on p.id = b.profile_id
  join public.accounts a on a.id = p.owner_id
  where b.is_visible
    and p.status = 'published'
    and a.status = 'active'
    and (b.starts_at is null or b.starts_at <= now())
    and (b.ends_at is null or b.ends_at > now());

revoke all on public.public_blocks from public, anon, authenticated;
grant select on public.public_blocks to anon, authenticated, service_role;

-- All or nothing: a partial or stale list is rejected rather than scrambling the page.
create function public.reorder_blocks(p_profile_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if cardinality(p_ids) is distinct from (select count(*) from public.blocks where profile_id = p_profile_id)
     or cardinality(p_ids) is distinct from (select count(distinct id) from unnest(p_ids) as t(id))
     or exists (
       select 1 from unnest(p_ids) as t(id)
       where not exists (select 1 from public.blocks b where b.id = t.id and b.profile_id = p_profile_id)
     ) then
    raise exception 'block list is out of date' using errcode = 'P0003';
  end if;

  update public.blocks b
  set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where b.id = o.id and b.profile_id = p_profile_id;
end;
$$;

revoke all on function public.reorder_blocks(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_blocks(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- social_links
-- ---------------------------------------------------------------------------

create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in (
    'instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'snapchat', 'twitch',
    'discord', 'whatsapp', 'telegram', 'github', 'reddit', 'spotify', 'soundcloud', 'apple_music',
    'threads', 'email', 'website'
  )),
  url text not null check (char_length(url) <= 2048 and url ~* '^(https?://|mailto:)[^[:space:]]+$'),
  position integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, platform)
);

create trigger social_links_set_updated_at
  before update on public.social_links
  for each row execute function public.set_updated_at();

create function public.prepare_new_social_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.position := (select coalesce(max(position), -1) + 1 from public.social_links where profile_id = new.profile_id);
  return new;
end;
$$;

create trigger social_links_prepare_new
  before insert on public.social_links
  for each row execute function public.prepare_new_social_link();

alter table public.social_links enable row level security;

revoke all on public.social_links from public, anon, authenticated;
grant select, delete on public.social_links to authenticated;
grant insert (profile_id, platform, url, is_visible) on public.social_links to authenticated;
grant update (url, is_visible) on public.social_links to authenticated;
grant all on public.social_links to service_role;

create policy "social_links: owner can read"
  on public.social_links for select to authenticated
  using (profile_id in (select id from public.profiles where owner_id = auth.uid()));

create policy "social_links: active owner can insert"
  on public.social_links for insert to authenticated
  with check (public.owns_profile(profile_id));

create policy "social_links: active owner can update"
  on public.social_links for update to authenticated
  using (public.owns_profile(profile_id))
  with check (public.owns_profile(profile_id));

create policy "social_links: active owner can delete"
  on public.social_links for delete to authenticated
  using (public.owns_profile(profile_id));

create view public.public_social_links
with (security_barrier = true)
as
  select s.id, s.profile_id, s.platform, s.url, s.position
  from public.social_links s
  join public.profiles p on p.id = s.profile_id
  join public.accounts a on a.id = p.owner_id
  where s.is_visible and p.status = 'published' and a.status = 'active';

revoke all on public.public_social_links from public, anon, authenticated;
grant select on public.public_social_links to anon, authenticated, service_role;

create function public.reorder_social_links(p_profile_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if cardinality(p_ids) is distinct from (select count(*) from public.social_links where profile_id = p_profile_id)
     or cardinality(p_ids) is distinct from (select count(distinct id) from unnest(p_ids) as t(id))
     or exists (
       select 1 from unnest(p_ids) as t(id)
       where not exists (select 1 from public.social_links s where s.id = t.id and s.profile_id = p_profile_id)
     ) then
    raise exception 'link list is out of date' using errcode = 'P0003';
  end if;

  update public.social_links s
  set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where s.id = o.id and s.profile_id = p_profile_id;
end;
$$;

revoke all on function public.reorder_social_links(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_social_links(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- leads: newsletter signups and contact-form messages sent to a creator
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  block_id uuid references public.blocks (id) on delete set null,
  kind text not null check (kind in ('newsletter', 'contact')),
  email text not null check (char_length(email) between 3 and 254),
  name text check (char_length(name) <= 120),
  message text check (char_length(message) <= 4000),
  consent_text text not null check (char_length(consent_text) between 1 and 500),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique nulls not distinct (profile_id, kind, email, message)
);

create index leads_profile_created_idx on public.leads (profile_id, created_at desc);

alter table public.leads enable row level security;

-- Visitors can't insert directly: submissions go through a rate-limited, spam-checked server action.
revoke all on public.leads from public, anon, authenticated;
grant select, delete on public.leads to authenticated;
grant all on public.leads to service_role;

create policy "leads: owner can read"
  on public.leads for select to authenticated
  using (profile_id in (select id from public.profiles where owner_id = auth.uid()));

create policy "leads: owner can delete"
  on public.leads for delete to authenticated
  using (profile_id in (select id from public.profiles where owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- contact_submissions: messages to FindMe itself, from the marketing site
-- ---------------------------------------------------------------------------

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index contact_submissions_created_idx on public.contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;
revoke all on public.contact_submissions from public, anon, authenticated;
grant all on public.contact_submissions to service_role;

create policy "contact_submissions: staff can read"
  on public.contact_submissions for select to authenticated
  using (public.is_admin());
grant select on public.contact_submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Media storage
-- ---------------------------------------------------------------------------

-- Public because page images must load for anyone. No SVG: it can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "profile-media: owner can read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile-media: active owner can upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_account()
  );

create policy "profile-media: active owner can delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_account()
  );

-- ---------------------------------------------------------------------------
-- Lock down the new trigger functions
-- ---------------------------------------------------------------------------

revoke all on function public.bump_profile_version() from public, anon, authenticated;
revoke all on function public.guard_username_change() from public, anon, authenticated;
revoke all on function public.prepare_new_block() from public, anon, authenticated;
revoke all on function public.prepare_new_social_link() from public, anon, authenticated;
