-- Real data for the Sit Clipboard feature.
--
-- Home access details (WiFi password, gate code, etc.) can't live on
-- `profiles` -- that table is intentionally public-readable so parents can
-- browse sitters, and this data must NOT be. It gets its own table with its
-- own narrow access rules: the owner themselves, or a sitter who has an
-- actual booking with that owner. Nobody else, ever.
--
-- meet_greet_notes on pets is a single free-text field (matching the
-- earlier decision not to build an accumulating notes log) that a sitter
-- fills in during the meet & greet and that saves back to the pet's
-- profile for next time.
--
-- Run this once in the Supabase SQL Editor.

create table owner_home_details (
  owner_id uuid primary key references profiles(id) on delete cascade,
  access_code text,
  wifi_password text,
  dustbin_day text,
  household_notes text,
  updated_at timestamptz not null default now()
);

alter table owner_home_details enable row level security;

create policy "Owners can view their own home details"
  on owner_home_details for select
  using (auth.uid() = owner_id);

create policy "Owners can insert their own home details"
  on owner_home_details for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own home details"
  on owner_home_details for update
  using (auth.uid() = owner_id);

create policy "Sitters can view home details for owners they're booked with"
  on owner_home_details for select
  using (
    exists (
      select 1 from bookings
      where bookings.owner_id = owner_home_details.owner_id
        and bookings.sitter_id = auth.uid()
    )
  );

grant select, insert, update on owner_home_details to anon, authenticated;

alter table pets add column meet_greet_notes text;

create policy "Sitters can update meet & greet notes for pets they're booked with"
  on pets for update
  using (
    exists (
      select 1 from bookings
      where bookings.pet_id = pets.id
        and bookings.sitter_id = auth.uid()
    )
  );
