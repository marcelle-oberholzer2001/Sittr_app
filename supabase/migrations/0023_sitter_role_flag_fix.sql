-- Two things:
--
-- 1. Migration 0022 revoked the table-wide UPDATE grant on profiles and
--    re-granted only specific columns, but missed is_sitter/is_owner --
--    these aren't sensitive the way id_verification_status is (nobody's
--    safety depends on them), and the signup page's own copy already
--    promises "you can add the other role later from your profile", so
--    they need to stay genuinely user-writable. Without this, the
--    sitter-onboarding fix in the app code (setting is_sitter = true on
--    finish) would itself get silently blocked by the same grant gap.
--
-- 2. A one-time data fix for a real account that hit this exact bug during
--    testing: it completed the full sitter onboarding wizard (coverage
--    areas, services, rates all correctly saved) but was never actually
--    flagged as a sitter, because the wizard's finish step never set
--    is_sitter -- so it was invisible in search despite a fully-filled-out
--    profile.
--
-- Run this once in the Supabase SQL Editor.

grant update (is_sitter, is_owner) on profiles to authenticated;

update profiles set is_sitter = true where id = '3a0f8bfc-3d59-4504-a2ab-f3db6be8ff6f';
