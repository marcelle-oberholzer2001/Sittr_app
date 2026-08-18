-- Adds the one parent-specific field not already on profiles.
-- full_name and phone already exist (shared with sitters).
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column emergency_contact text;
