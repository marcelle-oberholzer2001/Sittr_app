-- Replaces the old per-browser sessionStorage "verified" flags with a real,
-- shared status on the person's own profile. Three states, not just a
-- boolean, so the UI can honestly distinguish "never submitted" from
-- "submitted, waiting on review" -- there's no real document-review process
-- built yet (that's a later, more sensitive piece of work), so nothing in
-- the app can move a row to 'verified' by itself. That's an intentional
-- gap until real admin review exists.
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column id_verification_status text not null default 'not_started'
    check (id_verification_status in ('not_started', 'pending', 'verified'));
