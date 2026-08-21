-- The Sit Clipboard's "Confirmed at meet & greet" checkboxes (Feeding,
-- Medication, Walking & routine) were pure local React state -- they reset
-- to unchecked on every page reload, so a sitter's confirmation was never
-- actually remembered. Persisting them alongside the per-section notes
-- added in migration 0029.
--
-- Run this once in the Supabase SQL Editor.

alter table pets add column feeding_confirmed boolean not null default false;
alter table pets add column medication_confirmed boolean not null default false;
alter table pets add column walking_confirmed boolean not null default false;
