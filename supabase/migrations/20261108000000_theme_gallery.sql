-- Theme gallery: creators can share a page's look, and anyone signed in can use it. Free, like the
-- rest of FindMe. Only the theme is shared: never the creator's name, page or images, and a
-- theme is only data (colours and words from fixed lists), validated again by the app on use.

create table public.shared_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  theme jsonb not null check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) <= 8192),
  status text not null default 'listed' check (status in ('listed', 'removed')),
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now()
);

create index shared_themes_owner_idx on public.shared_themes (owner_id);
create index shared_themes_listed_idx on public.shared_themes (use_count desc, created_at desc) where status = 'listed';

-- Ten per person keeps the gallery from being flooded.
create function public.limit_shared_themes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 2));
  if (select count(*) from public.shared_themes where owner_id = new.owner_id) >= 10 then
    raise exception 'shared theme limit reached' using errcode = 'P0001';
  end if;
  new.status := 'listed';
  new.use_count := 0;
  return new;
end;
$$;

revoke all on function public.limit_shared_themes() from public, anon, authenticated;

create trigger shared_themes_limit
  before insert on public.shared_themes
  for each row execute function public.limit_shared_themes();

alter table public.shared_themes enable row level security;

revoke all on public.shared_themes from public, anon, authenticated;
grant select, delete on public.shared_themes to authenticated;
grant insert (owner_id, name, theme) on public.shared_themes to authenticated;
grant all on public.shared_themes to service_role;

create policy "shared_themes: owner can read"
  on public.shared_themes for select to authenticated
  using (owner_id = auth.uid());

create policy "shared_themes: active owner can insert"
  on public.shared_themes for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = auth.uid() and a.status = 'active')
  );

create policy "shared_themes: owner can delete"
  on public.shared_themes for delete to authenticated
  using (owner_id = auth.uid());

-- What the gallery shows. No owner, so nobody can find out who shared what.
create view public.gallery_themes
with (security_barrier = true)
as
  select t.id, t.name, t.theme, t.use_count, t.created_at
  from public.shared_themes t
  join public.accounts a on a.id = t.owner_id
  where t.status = 'listed' and a.status = 'active';

revoke all on public.gallery_themes from public, anon, authenticated;
grant select on public.gallery_themes to authenticated, service_role;

-- Returns a listed theme and counts the use. Counting your own themes would only inflate them.
create function public.use_gallery_theme(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_theme jsonb;
begin
  if auth.uid() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select g.theme into v_theme from public.gallery_themes g where g.id = p_id;
  if v_theme is null then
    raise exception 'theme not found' using errcode = 'P0002';
  end if;
  update public.shared_themes set use_count = use_count + 1 where id = p_id and owner_id <> auth.uid();
  return v_theme;
end;
$$;

revoke all on function public.use_gallery_theme(uuid) from public, anon, authenticated;
grant execute on function public.use_gallery_theme(uuid) to authenticated;

-- Moderation: staff take a theme out of the gallery, logged with the reason.
alter table public.moderation_actions drop constraint moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check
  check (target_type in ('account', 'profile', 'block', 'report', 'theme'));

create function public.admin_remove_shared_theme(p_actor uuid, p_theme uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(p_actor);
  update public.shared_themes set status = 'removed' where id = p_theme and status = 'listed';
  if not found then
    raise exception 'theme not found, or already removed' using errcode = 'P0005';
  end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (p_actor, 'theme.removed', 'theme', p_theme::text, p_reason);
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor, 'theme.removed', 'theme', p_theme::text, jsonb_build_object('reason', p_reason));
end;
$$;

revoke all on function public.admin_remove_shared_theme(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_remove_shared_theme(uuid, uuid, text) to service_role;
