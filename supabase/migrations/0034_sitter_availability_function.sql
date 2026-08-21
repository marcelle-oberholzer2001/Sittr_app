-- Search's "already booked on these dates" filter queried the bookings
-- table directly for every candidate sitter -- but the bookings SELECT
-- policy only allows a caller to see bookings where THEY are the owner or
-- sitter. For any owner browsing who isn't already involved with a given
-- sitter, that query silently returns nothing, so a sitter who's already
-- confirmed elsewhere on those exact dates still shows up as available.
-- Only a sitter's own manually-blocked dates (a separate, public table)
-- were ever actually filtering correctly.
--
-- This function runs with elevated privilege to check real bookings across
-- all candidate sitters, but returns nothing except which sitter_ids are
-- unavailable -- no booking details, owner identity, or pricing leaks out.
--
-- Run this once in the Supabase SQL Editor.

create or replace function get_unavailable_sitters(p_sitter_ids uuid[], p_date_from date, p_date_to date)
returns table(sitter_id uuid)
language sql
security definer
set search_path = public
as $$
  select bookings.sitter_id
  from bookings
  where bookings.sitter_id = any(p_sitter_ids)
    and bookings.status in ('accepted', 'agreed', 'paid')
    and bookings.date_from <= p_date_to
    and bookings.date_to >= p_date_from;
$$;

grant execute on function get_unavailable_sitters(uuid[], date, date) to anon, authenticated;
