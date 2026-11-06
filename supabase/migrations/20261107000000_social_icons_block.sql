-- Social icons now appear only where a page's Social icons block is. Before this, a page with no
-- such block showed them under the bio anyway, so hiding or deleting the block appeared to do
-- nothing. Every page gets the block at the top, where its icons used to appear, so no page
-- changes how it looks until its creator moves, hides or deletes the block.

-- One per page: a second copy would only show the same icons twice.
delete from public.blocks b
using public.blocks keep
where b.type = 'social_icons'
  and keep.type = 'social_icons'
  and keep.profile_id = b.profile_id
  and (keep.position, keep.created_at, keep.id) < (b.position, b.created_at, b.id);

create unique index blocks_one_social_icons_idx on public.blocks (profile_id) where type = 'social_icons';

do $$
declare
  v_profile uuid;
  v_block uuid;
begin
  for v_profile in
    select p.id from public.profiles p
    where not exists (select 1 from public.blocks b where b.profile_id = p.id and b.type = 'social_icons')
      -- A full page can't take another block. Its owner can make room and add one.
      and (select count(*) from public.blocks b where b.profile_id = p.id) < 200
  loop
    insert into public.blocks (profile_id, type, config) values (v_profile, 'social_icons', '{}'::jsonb)
    returning id into v_block;
    update public.blocks set position = position + 1 where profile_id = v_profile and id <> v_block;
    update public.blocks set position = 0 where id = v_block;
  end loop;
end;
$$;

-- New pages start with the block too, as their first item.
create function public.add_social_icons_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.blocks (profile_id, type, config) values (new.id, 'social_icons', '{}'::jsonb);
  return new;
end;
$$;

revoke all on function public.add_social_icons_block() from public, anon, authenticated;

create trigger profiles_d_add_social_icons
  after insert on public.profiles
  for each row execute function public.add_social_icons_block();
