-- Supabase's dashboard auto-grants these when you create tables through the
-- UI, but we created ours via raw SQL, which skips it. Without this, RLS
-- policies never even get evaluated -- Postgres blocks access one layer
-- before that, at the "can this role touch this table at all" check.
-- Run this once in the Supabase SQL Editor.

grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.pets to anon, authenticated;
grant select, insert, update, delete on public.bookings to anon, authenticated;
