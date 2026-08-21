-- Two changes to pet care details:
--
-- 1. The Sit Clipboard's single "meet_greet_notes" free-text field is split
--    into separate per-section notes (feeding, medication, walking &
--    routine), so a sitter can jot something right where they discussed it
--    during a meet & greet instead of one combined block at the end.
--    Existing pet UPDATE policies for sitters already cover any column on a
--    pet they're booked for (see migration 0011), so no new grants or
--    policies are needed for the new columns.
--
-- 2. Vet info is simplified to just the vet's name -- a sitter can look up
--    the address/phone themselves, so those two fields are dropped.
--
-- Run this once in the Supabase SQL Editor.

alter table pets add column feeding_notes text;
alter table pets add column medication_notes text;
alter table pets add column walking_notes text;

alter table pets drop column if exists meet_greet_notes;
alter table pets drop column if exists vet_phone;
alter table pets drop column if exists vet_address;
