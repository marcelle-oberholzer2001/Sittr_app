-- Adds the fields a sitter fills in on their profile: a short bio, plus the
-- three list-style fields (coverage suburbs, services offered, animal types
-- they're comfortable with). Stored as simple text arrays on profiles rather
-- than separate tables -- same pattern as pets.personality -- since nothing
-- yet needs to join or filter across sitters by these values.
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column bio text,
  add column coverage_areas text[] not null default '{}',
  add column services text[] not null default '{}',
  add column comfortable_with text[] not null default '{}';
