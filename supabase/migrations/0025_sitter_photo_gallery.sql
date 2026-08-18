-- Real multi-photo gallery for sitters (up to 5), replacing the single
-- avatar-only upload. Position 1 is always the profile photo -- kept in
-- sync with profiles.avatar_url by the trigger below, so every existing
-- place in the app that reads avatar_url (browse cards, chat, etc.) keeps
-- working without needing to know sitter_photos exists at all.
--
-- Deliberately no direct insert/update/delete grants on the table -- every
-- write goes through add_sitter_photo / remove_sitter_photo, which handle
-- the position bookkeeping (next free slot, re-closing gaps on removal)
-- atomically. The unique constraint is deferrable so a removal's
-- reindexing update can't trip over its own intermediate states regardless
-- of what order Postgres happens to process the affected rows in.
--
-- Run this once in the Supabase SQL Editor.

create table sitter_photos (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references profiles(id) on delete cascade,
  photo_url text not null,
  position int not null check (position between 1 and 5),
  created_at timestamptz not null default now(),
  unique (sitter_id, position) deferrable initially deferred
);

alter table sitter_photos enable row level security;

create policy "Sitter photos are publicly viewable"
  on sitter_photos for select
  using (true);

grant select on sitter_photos to authenticated, anon;

create or replace function add_sitter_photo(p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_position int;
begin
  select coalesce(max(position), 0) + 1 into next_position
  from sitter_photos where sitter_id = auth.uid();

  if next_position > 5 then
    raise exception 'Maximum of 5 photos allowed.';
  end if;

  insert into sitter_photos (sitter_id, photo_url, position)
  values (auth.uid(), p_photo_url, next_position);
end;
$$;

grant execute on function add_sitter_photo(text) to authenticated;

create or replace function remove_sitter_photo(p_position int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from sitter_photos where sitter_id = auth.uid() and position = p_position;

  update sitter_photos
  set position = position - 1
  where sitter_id = auth.uid() and position > p_position;
end;
$$;

grant execute on function remove_sitter_photo(int) to authenticated;

create or replace function sync_avatar_from_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set avatar_url = (
    select photo_url from sitter_photos
    where sitter_id = coalesce(new.sitter_id, old.sitter_id) and position = 1
  )
  where id = coalesce(new.sitter_id, old.sitter_id);
  return coalesce(new, old);
end;
$$;

create trigger sitter_photos_sync_avatar
  after insert or update or delete on sitter_photos
  for each row
  execute function sync_avatar_from_photos();
