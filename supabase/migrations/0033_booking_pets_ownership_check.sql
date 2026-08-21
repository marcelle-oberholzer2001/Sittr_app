-- The "Owners can add pets to their own booking" policy only checked that
-- the caller owns the BOOKING -- not that they own the PET being linked.
-- That meant an owner could attach a stranger's pet_id to their own
-- booking, and since the sitter-can-view-linked-pets policy trusts
-- booking_pets, the sitter on that booking would then be able to read that
-- stranger's private pet record (feeding, medication, vet, allergies)
-- through the Sit Clipboard. Legitimate booking creation always links only
-- the owner's own pets already, so this tightening changes nothing for
-- real usage.
--
-- Run this once in the Supabase SQL Editor.

drop policy if exists "Owners can add pets to their own booking" on booking_pets;

create policy "Owners can add their own pets to their own booking"
  on booking_pets for insert
  with check (
    exists (
      select 1 from bookings
      where bookings.id = booking_pets.booking_id
        and bookings.owner_id = auth.uid()
    )
    and exists (
      select 1 from pets
      where pets.id = booking_pets.pet_id
        and pets.owner_id = auth.uid()
    )
  );
