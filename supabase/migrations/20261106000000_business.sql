-- Phase 6: several pages per account, custom domains, lead custom fields, reports, moderation,
-- platform settings, and admin actions that can't happen without being logged.

insert into public.reserved_usernames (name, kind)
select unnest(array['report']), 'reserved'::public.reserved_username_kind
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Platform settings
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  key text primary key check (key in ('max_profiles_per_account', 'announcement')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.platform_settings (key, value) values
  ('max_profiles_per_account', '5'::jsonb),
  ('announcement', '""'::jsonb);

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;
grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;

create policy "platform_settings: signed-in users can read"
  on public.platform_settings for select to authenticated
  using (true);

-- The limit now comes from settings instead of being fixed at one.
create or replace function public.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  select coalesce((value #>> '{}')::integer, 1) into v_limit
  from public.platform_settings where key = 'max_profiles_per_account';
  if (select count(*) from public.profiles p where p.owner_id = new.owner_id) >= coalesce(v_limit, 1) then
    raise exception 'profile limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- A page needs its setup marked complete without going through the wizard again.
grant insert (onboarding_completed_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Lead custom fields
-- ---------------------------------------------------------------------------

alter table public.leads
  add column custom_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(custom_fields) = 'object' and pg_column_size(custom_fields) <= 4096);

-- ---------------------------------------------------------------------------
-- Custom domains
-- ---------------------------------------------------------------------------

create table public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  hostname text not null unique check (
    char_length(hostname) <= 253
    and hostname = lower(hostname)
    and hostname ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  verification_token text not null default encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'active', 'failed')),
  last_error text check (char_length(last_error) <= 300),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_domains_profile_id_idx on public.custom_domains (profile_id);

create trigger custom_domains_set_updated_at
  before update on public.custom_domains
  for each row execute function public.set_updated_at();

alter table public.custom_domains enable row level security;
revoke all on public.custom_domains from public, anon, authenticated;
-- Users can add and remove domains. Only the server can change status, after checking DNS.
grant select, delete on public.custom_domains to authenticated;
grant insert (profile_id, hostname) on public.custom_domains to authenticated;
grant all on public.custom_domains to service_role;

create policy "custom_domains: owner can read"
  on public.custom_domains for select to authenticated
  using (profile_id in (select id from public.profiles where owner_id = auth.uid()));

create policy "custom_domains: active owner can add"
  on public.custom_domains for insert to authenticated
  with check (public.owns_profile(profile_id));

create policy "custom_domains: active owner can remove"
  on public.custom_domains for delete to authenticated
  using (public.owns_profile(profile_id));

-- Used for every request on a custom domain. Returns only what a public page already shows.
create function public.resolve_custom_domain(p_hostname text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.username
  from public.custom_domains d
  join public.profiles p on p.id = d.profile_id
  join public.accounts a on a.id = p.owner_id
  where d.hostname = lower(p_hostname) and d.status = 'active' and p.status = 'published' and a.status = 'active';
$$;

revoke all on function public.resolve_custom_domain(text) from public, anon, authenticated;
grant execute on function public.resolve_custom_domain(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reports and moderation
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  block_id uuid references public.blocks (id) on delete set null,
  username_snapshot text not null check (char_length(username_snapshot) <= 30),
  reason text not null check (reason in ('spam', 'scam', 'impersonation', 'harassment', 'illegal', 'adult', 'other')),
  details text check (char_length(details) <= 2000),
  reporter_email text check (char_length(reporter_email) <= 254),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now()
);

create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_profile_id_idx on public.reports (profile_id);
create index reports_block_id_idx on public.reports (block_id);

alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;
grant all on public.reports to service_role;

-- Like the audit log, this is a permanent record, so actor and target aren't foreign keys.
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  actor_id uuid not null,
  action text not null check (char_length(action) <= 64),
  target_type text not null check (target_type in ('account', 'profile', 'block', 'report')),
  target_id text not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index moderation_actions_created_idx on public.moderation_actions (created_at desc);
create index moderation_actions_report_id_idx on public.moderation_actions (report_id);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from public, anon, authenticated;
grant select, insert on public.moderation_actions to service_role;

-- ---------------------------------------------------------------------------
-- Admin actions: the change and its log entry commit together, or not at all
-- ---------------------------------------------------------------------------

create function public.require_staff(p_actor uuid, p_admin_only boolean default false)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_roles r
    where r.user_id = p_actor and (r.role = 'admin' or not p_admin_only)
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_set_account_status(p_actor uuid, p_target uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(p_actor);
  if p_actor = p_target then
    raise exception 'you cannot change your own account status' using errcode = 'P0004';
  end if;
  if exists (select 1 from public.admin_roles r where r.user_id = p_target) then
    raise exception 'remove the staff role first' using errcode = 'P0004';
  end if;

  update public.accounts set status = p_status where id = p_target;
  if not found then
    raise exception 'account not found' using errcode = 'P0005';
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (p_actor, case when p_status = 'suspended' then 'account.suspended' else 'account.restored' end, 'account', p_target::text, p_reason);
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor, case when p_status = 'suspended' then 'account.suspended' else 'account.restored' end, 'account', p_target::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Suspending a page, or restoring one to unpublished so its owner decides when it goes live again.
create function public.admin_set_profile_suspended(p_actor uuid, p_profile uuid, p_suspended boolean, p_reason text, p_report uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := case when p_suspended then 'profile.suspended' else 'profile.restored' end;
begin
  perform public.require_staff(p_actor);

  update public.profiles
  set status = (case when p_suspended then 'suspended' else 'unpublished' end)::public.profile_status
  where id = p_profile and (status = 'suspended') is distinct from p_suspended;
  if not found then
    raise exception 'profile not found, or already in that state' using errcode = 'P0005';
  end if;

  insert into public.moderation_actions (report_id, actor_id, action, target_type, target_id, reason)
  values (p_report, p_actor, v_action, 'profile', p_profile::text, p_reason);
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor, v_action, 'profile', p_profile::text, jsonb_build_object('reason', p_reason, 'report', p_report));
end;
$$;

create function public.admin_hide_block(p_actor uuid, p_block uuid, p_reason text, p_report uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(p_actor);

  update public.blocks set is_visible = false where id = p_block;
  if not found then
    raise exception 'link not found' using errcode = 'P0005';
  end if;

  insert into public.moderation_actions (report_id, actor_id, action, target_type, target_id, reason)
  values (p_report, p_actor, 'block.hidden', 'block', p_block::text, p_reason);
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor, 'block.hidden', 'block', p_block::text, jsonb_build_object('reason', p_reason, 'report', p_report));
end;
$$;

create function public.admin_close_report(p_actor uuid, p_report uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(p_actor);
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.reports
  set status = p_status, resolved_at = now(), resolved_by = p_actor
  where id = p_report and status = 'open';
  if not found then
    raise exception 'report not found, or already closed' using errcode = 'P0005';
  end if;

  insert into public.moderation_actions (report_id, actor_id, action, target_type, target_id, reason)
  values (p_report, p_actor, 'report.' || p_status, 'report', p_report::text, p_reason);
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor, 'report.' || p_status, 'report', p_report::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Settings affect everyone, so they're for admins and not moderators.
create function public.admin_update_setting(p_actor uuid, p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  perform public.require_staff(p_actor, true);

  select value into v_old from public.platform_settings where key = p_key;
  update public.platform_settings set value = p_value, updated_at = now(), updated_by = p_actor where key = p_key;
  if not found then
    raise exception 'unknown setting' using errcode = 'P0005';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor, 'setting.updated', 'setting', p_key, jsonb_build_object('old', v_old, 'new', p_value));
end;
$$;

revoke all on function public.require_staff(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_set_account_status(uuid, uuid, public.account_status, text) from public, anon, authenticated;
revoke all on function public.admin_set_profile_suspended(uuid, uuid, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_hide_block(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_close_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_setting(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.require_staff(uuid, boolean) to service_role;
grant execute on function public.admin_set_account_status(uuid, uuid, public.account_status, text) to service_role;
grant execute on function public.admin_set_profile_suspended(uuid, uuid, boolean, text, uuid) to service_role;
grant execute on function public.admin_hide_block(uuid, uuid, text, uuid) to service_role;
grant execute on function public.admin_close_report(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_update_setting(uuid, text, jsonb) to service_role;
