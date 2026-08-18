-- A plain client-side UPDATE can't reassign bookings.sitter_id to someone
-- else when it's the CURRENT sitter making the change: Postgres re-checks
-- the updated row against the table's SELECT policy (this happens whenever
-- a query has a RETURNING clause, which PostgREST always uses internally,
-- regardless of the Prefer header) -- and after reassignment, the referring
-- sitter is no longer sitter_id or owner_id, so they fail to "see" the very
-- row they just updated, and Postgres rejects the write outright.
--
-- SOS's owner-approval handoff doesn't hit this, because the owner stays
-- owner_id before and after. Referral is the first case where the person
-- making the change stops being an involved party as a result of the
-- change itself -- so it needs its own security-definer function instead,
-- with the authorization check written directly into its WHERE clause.
--
-- Run this once in the Supabase SQL Editor.

create or replace function refer_booking(
  p_booking_id uuid,
  p_new_sitter_id uuid,
  p_sitting_fee numeric,
  p_platform_fee numeric,
  p_total_paid numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings
  set sitter_id = p_new_sitter_id,
      sitting_fee = p_sitting_fee,
      platform_fee = p_platform_fee,
      total_paid = p_total_paid,
      responded_at = null
  where id = p_booking_id
    and sitter_id = auth.uid()
    and status = 'pending';
end;
$$;

grant execute on function refer_booking(uuid, uuid, numeric, numeric, numeric) to authenticated;
