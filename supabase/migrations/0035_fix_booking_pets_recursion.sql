-- Migration 0033's booking_pets INSERT policy queried `pets` directly in
-- its WITH CHECK. That query triggers RLS evaluation on pets, which
-- includes the sitter-visibility policy (migration 0011) that queries back
-- into booking_pets -- a cycle Postgres's RLS planner refuses to evaluate
-- ("infinite recursion detected in policy for relation booking_pets").
-- This broke ALL booking_pets inserts, including legitimate ones, not just
-- the malicious case the policy was meant to catch.
--
-- Fix: check pet ownership through a SECURITY DEFINER function instead of
-- a plain subquery. Because it runs with elevated privilege, it reads
-- `pets` directly without re-triggering pets' own RLS policies, breaking
-- the cycle entirely.
--
-- Run this once in the Supabase SQL Editor.

create or replace function owns_pet(p_pet_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from pets where pets.id = p_pet_id and pets.owner_id = auth.uid());
$$;

grant execute on function owns_pet(uuid) to authenticated;

drop policy if exists "Owners can add their own pets to their own booking" on booking_pets;

create policy "Owners can add their own pets to their own booking"
  on booking_pets for insert
  with check (
    exists (
      select 1 from bookings
      where bookings.id = booking_pets.booking_id
        and bookings.owner_id = auth.uid()
    )
    and owns_pet(booking_pets.pet_id)
  );
