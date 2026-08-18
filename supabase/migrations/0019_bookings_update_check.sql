-- The "Involved parties can update a booking" policy (migration 0001) has a
-- USING clause but no WITH CHECK. Postgres defaults an omitted WITH CHECK to
-- the USING clause itself, which silently breaks any update that changes
-- who the involved parties ARE -- e.g. a sitter referring a pending request
-- to a different sitter: after that update, auth.uid() no longer matches
-- the new sitter_id or the owner_id, so Postgres rejects the sitter's own
-- update with "new row violates row-level security policy".
--
-- USING already gates who may touch the row in the first place (must
-- currently be the sitter or owner); WITH CHECK doesn't need to re-verify
-- that against the new values, so this makes it permissive instead.
--
-- Using drop + recreate rather than ALTER POLICY, since it's unambiguous
-- about ending up with exactly this definition regardless of what's there now.
--
-- Run this once in the Supabase SQL Editor.

drop policy if exists "Involved parties can update a booking" on bookings;

create policy "Involved parties can update a booking"
  on bookings for update
  using (auth.uid() = sitter_id or auth.uid() = owner_id)
  with check (true);
