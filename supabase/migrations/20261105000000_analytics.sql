-- Privacy-aware analytics: raw events for 30 days, daily totals kept after that, and basic admin figures.
--
-- Raw IP addresses are never stored. A visitor is a salted hash, and the salt rotates daily and is
-- then destroyed, so nobody, including us, can link a visitor across days or recover who they were.

-- The click route /l/{id} needs a top-level path. Usernames need 3+ characters anyway; this keeps the
-- rule that every top-level route is reserved.
insert into public.reserved_usernames (name, kind)
select unnest(array['l']), 'reserved'::public.reserved_username_kind
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Creator-level privacy control
-- ---------------------------------------------------------------------------

alter table public.profiles add column analytics_enabled boolean not null default true;
grant update (analytics_enabled) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.analytics_salts (
  day date primary key,
  salt text not null
);

alter table public.analytics_salts enable row level security;
revoke all on public.analytics_salts from public, anon, authenticated;
grant all on public.analytics_salts to service_role;

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  block_id uuid references public.blocks (id) on delete set null,
  event_type text not null check (event_type in ('view', 'click')),
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  dedupe_key text not null unique,
  referrer_category text check (char_length(referrer_category) <= 32),
  device_category text check (char_length(device_category) <= 32),
  browser_category text check (char_length(browser_category) <= 32),
  os_category text check (char_length(os_category) <= 32),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  occurred_at timestamptz not null default now()
);

create index analytics_events_occurred_at_idx on public.analytics_events (occurred_at);
create index analytics_events_visitor_idx on public.analytics_events (profile_id, visitor_hash);
create index analytics_events_block_id_idx on public.analytics_events (block_id);

-- Visitor-level rows stay closed to everyone but the server, including the page's owner.
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;
grant all on public.analytics_events to service_role;

create table public.analytics_daily (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  dimension text not null check (dimension in ('total', 'referrer', 'device', 'browser', 'os', 'country', 'block')),
  dimension_value text not null check (char_length(dimension_value) <= 64),
  views integer not null default 0,
  clicks integer not null default 0,
  uniques integer not null default 0,
  primary key (profile_id, day, dimension, dimension_value)
);

alter table public.analytics_daily enable row level security;
revoke all on public.analytics_daily from public, anon, authenticated;
grant select on public.analytics_daily to authenticated;
grant all on public.analytics_daily to service_role;

create policy "analytics_daily: owner can read"
  on public.analytics_daily for select to authenticated
  using (profile_id in (select id from public.profiles where owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Collection
-- ---------------------------------------------------------------------------

create function public.purge_expired_analytics()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  -- Batched, so a backlog can't turn into one long lock during someone's page view.
  delete from public.analytics_events
  where id in (
    select id from public.analytics_events
    where occurred_at < now() - interval '30 days'
    limit 1000
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_analytics() from public, anon, authenticated;
grant execute on function public.purge_expired_analytics() to service_role;

-- Records one event and updates the daily totals in the same transaction. Returns false when the
-- event was ignored: a duplicate, an unpublished page, or a creator who has turned analytics off.
create function public.record_analytics_event(
  p_profile_id uuid,
  p_block_id uuid,
  p_event_type text,
  p_visitor_source text,
  p_referrer text,
  p_device text,
  p_browser text,
  p_os text,
  p_country text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_salt text;
  v_hash text;
  v_bucket bigint;
  v_key text;
  v_is_new_visitor boolean;
  v_id uuid;
  v_pair record;
begin
  if p_event_type not in ('view', 'click') then
    raise exception 'unknown event type' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    join public.accounts a on a.id = p.owner_id
    where p.id = p_profile_id and p.status = 'published' and a.status = 'active' and p.analytics_enabled
  ) then
    return false;
  end if;

  if p_event_type = 'click' and not exists (
    select 1 from public.blocks b where b.id = p_block_id and b.profile_id = p_profile_id
  ) then
    return false;
  end if;

  insert into public.analytics_salts (day, salt)
  values (v_day, encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'))
  on conflict (day) do nothing;
  select salt into v_salt from public.analytics_salts where day = v_day;
  -- Destroying old salts is what makes yesterday's hashes impossible to link to anyone.
  delete from public.analytics_salts where day < v_day;

  v_hash := encode(sha256(convert_to(v_salt || '|' || p_profile_id::text || '|' || coalesce(p_visitor_source, ''), 'UTF8')), 'hex');

  -- A reload within 30 minutes isn't a new view, and a double-tap isn't two clicks.
  v_bucket := floor(extract(epoch from now()) / case when p_event_type = 'view' then 1800 else 60 end);
  v_key := p_event_type || '|' || coalesce(p_block_id::text, '') || '|' || v_hash || '|' || v_bucket::text;

  -- The hash changes daily, so any earlier view with this hash happened today.
  v_is_new_visitor := p_event_type = 'view' and not exists (
    select 1 from public.analytics_events e
    where e.profile_id = p_profile_id and e.visitor_hash = v_hash and e.event_type = 'view'
  );

  insert into public.analytics_events (
    profile_id, block_id, event_type, visitor_hash, dedupe_key,
    referrer_category, device_category, browser_category, os_category, country_code
  )
  values (
    p_profile_id, p_block_id, p_event_type, v_hash, v_key,
    p_referrer, p_device, p_browser, p_os, p_country
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    return false;
  end if;

  insert into public.analytics_daily as d (profile_id, day, dimension, dimension_value, views, clicks, uniques)
  values (
    p_profile_id, v_day, 'total', '',
    (p_event_type = 'view')::integer, (p_event_type = 'click')::integer, v_is_new_visitor::integer
  )
  on conflict (profile_id, day, dimension, dimension_value) do update set
    views = d.views + excluded.views,
    clicks = d.clicks + excluded.clicks,
    uniques = d.uniques + excluded.uniques;

  if p_event_type = 'click' then
    insert into public.analytics_daily as d (profile_id, day, dimension, dimension_value, clicks)
    values (p_profile_id, v_day, 'block', p_block_id::text, 1)
    on conflict (profile_id, day, dimension, dimension_value) do update set clicks = d.clicks + 1;
  else
    for v_pair in
      select * from (values
        ('referrer', p_referrer), ('device', p_device), ('browser', p_browser), ('os', p_os), ('country', p_country)
      ) as t(dimension, value)
      where t.value is not null
    loop
      insert into public.analytics_daily as d (profile_id, day, dimension, dimension_value, views, uniques)
      values (p_profile_id, v_day, v_pair.dimension, v_pair.value, 1, v_is_new_visitor::integer)
      on conflict (profile_id, day, dimension, dimension_value) do update set
        views = d.views + 1,
        uniques = d.uniques + excluded.uniques;
    end loop;
  end if;

  -- Retention needs no scheduler: a small share of events tidies up after the rest.
  if random() < 0.01 then
    perform public.purge_expired_analytics();
  end if;

  return true;
end;
$$;

revoke all on function public.record_analytics_event(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_analytics_event(uuid, uuid, text, text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Admin figures
-- ---------------------------------------------------------------------------

-- Service role only. The server checks the caller's admin role before using it.
create function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'registered_users', (select count(*) from public.accounts),
    'active_users', (select count(*) from public.accounts where status = 'active'),
    'suspended_users', (select count(*) from public.accounts where status = 'suspended'),
    'published_profiles', (select count(*) from public.profiles where status = 'published'),
    'total_views', (select coalesce(sum(views), 0) from public.analytics_daily where dimension = 'total'),
    'total_clicks', (select coalesce(sum(clicks), 0) from public.analytics_daily where dimension = 'total')
  );
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;
