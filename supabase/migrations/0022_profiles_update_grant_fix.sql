-- Migration 0021's column-level REVOKE on id_verification_status (and the
-- other admin-only columns) had no actual effect: profiles.authenticated
-- also holds a *table-wide* UPDATE grant from migration 0002, and
-- Postgres only restricts a column-level REVOKE against a privilege that
-- was itself granted at the column level -- it doesn't reach into a
-- broader table-wide grant. Confirmed this by testing directly: a plain
-- client update setting id_verification_status = 'verified' on your own
-- row still succeeded after 0021.
--
-- The real fix: revoke the table-wide UPDATE grant entirely, and re-grant
-- UPDATE only on the columns a user should ever legitimately change on
-- their own profile via ordinary app code (compiled from every
-- .update(...) call on profiles in the codebase). id_verification_status,
-- id_verification_note, is_admin, and id_document_path are deliberately
-- left out -- those stay reachable only through submit_id_verification()
-- and review_id_verification(), which run with elevated privileges
-- regardless of column grants.
--
-- Run this once in the Supabase SQL Editor.

revoke update on profiles from authenticated;

grant update (
  full_name, phone, bio, coverage_areas, services, comfortable_with,
  rates, avatar_url, emergency_contact
) on profiles to authenticated;
