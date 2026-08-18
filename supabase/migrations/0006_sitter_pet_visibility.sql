-- A sitter needs to see basic info (name, size, etc.) for a pet they have
-- a real booking for, so their Requests screen can show what they're being
-- asked to sit. Previously pets were owner-only -- this was flagged as a
-- TODO back in migration 0001, for exactly this moment.
-- Run this once in the Supabase SQL Editor.

create policy "Sitters can view pets they're booked to sit for"
  on pets for select
  using (
    exists (
      select 1 from bookings
      where bookings.pet_id = pets.id
        and bookings.sitter_id = auth.uid()
    )
  );
