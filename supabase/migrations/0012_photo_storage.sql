-- Real file storage for pet and profile photos. Supabase Storage buckets
-- live in their own schema but use the same RLS-policy approach as regular
-- tables. This bucket is public-read (photos need to be visible to anyone
-- browsing sitters or viewing a Sit Clipboard, same as the rest of a
-- profile), but a user can only upload/change/delete files inside their own
-- folder -- enforced by requiring the file path to start with their own
-- user id (auth.uid()).
--
-- Deliberately not used for ID documents -- those need their own, more
-- carefully scoped (private, not public-read) storage setup later.
--
-- Run this once in the Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true);

create policy "Photos are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "Users can upload their own photos"
  on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own photos"
  on storage.objects for update
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own photos"
  on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
