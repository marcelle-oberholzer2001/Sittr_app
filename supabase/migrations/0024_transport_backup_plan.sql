-- Replaces the fake "upload your license" onboarding step (nobody was ever
-- going to manually verify a license photo) with an honest self-declared
-- yes/no, plus a real backup-driver contact captured only when the answer
-- is no. This needs to reach the owner, so it's surfaced in the booking
-- agreement's emergency plan section alongside vet details.
--
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column has_drivers_license boolean,
  add column backup_driver_contact text;

grant update (has_drivers_license, backup_driver_contact) on profiles to authenticated;
