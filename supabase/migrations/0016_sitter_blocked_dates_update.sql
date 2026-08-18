-- The availability calendar uses upsert() with onConflict to block date
-- ranges idempotently. Postgres implements upsert as INSERT ... ON CONFLICT
-- DO UPDATE, which needs UPDATE privileges even though the app never issues
-- a plain update itself. Without this, blocking dates fails with
-- "permission denied for table sitter_blocked_dates".
--
-- Run this once in the Supabase SQL Editor.

create policy "Sitters can update their own blocked dates"
  on sitter_blocked_dates for update
  using (auth.uid() = sitter_id)
  with check (auth.uid() = sitter_id);

grant update on sitter_blocked_dates to authenticated;
