-- Real ID-document review. Until now, "Submit for verification" just
-- flipped id_verification_status to 'pending' with no document attached
-- anywhere, and nothing could ever move a row to 'verified' -- an
-- intentional gap flagged back in migration 0008, pending this piece.
--
-- Security note: id_verification_status is exactly the kind of field a
-- malicious client could otherwise set directly to 'verified' via a raw API
-- call, since the existing "users can update own profile" policy has no
-- column restriction -- RLS alone doesn't stop a user from writing whatever
-- they want to their own row. The column-level REVOKE below closes that off
-- entirely: regular profile updates can no longer touch these columns at
-- all, so the two functions below (submit for the user, review for an
-- admin) become the only way in or out of this workflow.
--
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column id_document_path text,
  add column id_verification_note text,
  add column is_admin boolean not null default false;

alter table profiles drop constraint profiles_id_verification_status_check;
alter table profiles add constraint profiles_id_verification_status_check
  check (id_verification_status in ('not_started', 'pending', 'verified', 'rejected'));

revoke update (id_verification_status, id_verification_note, is_admin, id_document_path)
  on profiles from authenticated;

create or replace function submit_id_verification(p_document_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set id_document_path = p_document_path,
      id_verification_status = 'pending',
      id_verification_note = null
  where id = auth.uid();
end;
$$;

grant execute on function submit_id_verification(text) to authenticated;

create or replace function review_id_verification(p_user_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Only an admin can review ID verifications.';
  end if;

  update profiles
  set id_verification_status = case when p_approve then 'verified' else 'rejected' end,
      id_verification_note = p_note
  where id = p_user_id;
end;
$$;

grant execute on function review_id_verification(uuid, boolean, text) to authenticated;

-- Private bucket -- NOT public-read, unlike the "photos" bucket. Only the
-- document's owner and an admin can ever read a file back out.
insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false);

create policy "Users can upload their own ID documents"
  on storage.objects for insert
  with check (bucket_id = 'id-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can replace their own ID documents"
  on storage.objects for update
  using (bucket_id = 'id-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owners and admins can view ID documents"
  on storage.objects for select
  using (
    bucket_id = 'id-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
    )
  );
