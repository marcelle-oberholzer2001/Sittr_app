-- Janco (technical co-founder) is bringing his own ID-verification
-- integration, so the photo-upload + admin-review flow from migration 0021
-- is being replaced with a plain SA ID number field for now: format-checked
-- only (exactly 13 digits), marked verified immediately, no review step.
-- This is intentionally a placeholder for Janco's real verification logic
-- to slot into later -- the old document-review path is removed rather
-- than left half-wired since nothing will call it anymore.
--
-- Existing rows stuck in 'pending' or 'rejected' (from the old document
-- flow, which never had a real reviewer) are reset to 'not_started' since
-- there's no document behind them to carry forward and no review process
-- left to act on them.
--
-- Run this once in the Supabase SQL Editor.

alter table profiles add column id_number text;

update profiles
set id_verification_status = 'not_started',
    id_verification_note = null
where id_verification_status in ('pending', 'rejected');

alter table profiles drop column if exists id_document_path;
alter table profiles drop column if exists id_verification_note;

drop function if exists review_id_verification(uuid, boolean, text);
drop function if exists submit_id_verification(text);

create or replace function submit_id_number(p_id_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id_number !~ '^[0-9]{13}$' then
    raise exception 'ID number must be exactly 13 digits.';
  end if;

  update profiles
  set id_number = p_id_number,
      id_verification_status = 'verified'
  where id = auth.uid();
end;
$$;

grant execute on function submit_id_number(text) to authenticated;
