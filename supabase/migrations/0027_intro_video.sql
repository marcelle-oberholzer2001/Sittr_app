-- Real intro video upload, replacing the fake "Add a short intro video"
-- button that just flipped a local boolean with nothing ever stored.
--
-- A dedicated bucket rather than reusing "photos" -- videos are much
-- larger and a different content type, and uploadPhoto() explicitly
-- rejects non-image files. Public-read, same per-user-folder write
-- pattern as the photos bucket, since the whole point is owners watching
-- it on the sitter's public profile.
--
-- intro_video_url is not a sensitive/trust field (unlike
-- id_verification_status), so it's just added to the normal set of
-- self-editable profile columns, same as avatar_url.
--
-- Run this once in the Supabase SQL Editor.

alter table profiles add column intro_video_url text;

grant update (intro_video_url) on profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('sitter-videos', 'sitter-videos', true, 52428800);

create policy "Intro videos are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'sitter-videos');

create policy "Users can upload their own intro video"
  on storage.objects for insert
  with check (bucket_id = 'sitter-videos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can replace their own intro video"
  on storage.objects for update
  using (bucket_id = 'sitter-videos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own intro video"
  on storage.objects for delete
  using (bucket_id = 'sitter-videos' and auth.uid()::text = (storage.foldername(name))[1]);
