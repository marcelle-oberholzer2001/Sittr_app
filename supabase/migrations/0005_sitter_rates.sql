-- Stores a sitter's per-service rates as JSON, keyed by service (visit1,
-- visit2, daysit, overnight, walking, boarding, daycare) -- same shape as
-- DEFAULT_RATES in src/lib/pet-services.ts. A jsonb column fits better than
-- a text[] here since each entry needs two fields (enabled, rate), not just
-- a single value.
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column rates jsonb not null default '{}'::jsonb;
