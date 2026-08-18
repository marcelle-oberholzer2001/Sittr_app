-- Real availability tracking. A sitter's blocked dates need to be readable
-- by anyone searching (same transparency level as coverage areas or rates
-- -- a sitter's calendar isn't sensitive, it's exactly what a parent needs
-- to filter search results), but only the sitter themselves can add or
-- remove their own blocked dates.
--
-- Run this once in the Supabase SQL Editor.

create table sitter_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  unique (sitter_id, date)
);

alter table sitter_blocked_dates enable row level security;

create policy "Blocked dates are publicly viewable"
  on sitter_blocked_dates for select
  using (true);

create policy "Sitters can add their own blocked dates"
  on sitter_blocked_dates for insert
  with check (auth.uid() = sitter_id);

create policy "Sitters can remove their own blocked dates"
  on sitter_blocked_dates for delete
  using (auth.uid() = sitter_id);

grant select, insert, delete on sitter_blocked_dates to authenticated;
