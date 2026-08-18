-- A booking could previously only ever be tied to one pet (bookings.pet_id),
-- which meant a parent with 2+ pets literally could not request a single
-- sitter for all of them at once -- a real limitation for most pet owners.
-- This replaces the single pet_id column with a proper many-to-many join
-- table, so one booking can cover multiple pets.
--
-- Existing pet_id data is preserved by copying it into the new table before
-- the old column is dropped.
--
-- Run this once in the Supabase SQL Editor.

create table booking_pets (
  booking_id uuid not null references bookings(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  primary key (booking_id, pet_id)
);

alter table booking_pets enable row level security;

create policy "Involved parties can view booking_pets"
  on booking_pets for select
  using (
    exists (
      select 1 from bookings
      where bookings.id = booking_pets.booking_id
        and (bookings.owner_id = auth.uid() or bookings.sitter_id = auth.uid())
    )
  );

create policy "Owners can add pets to their own booking"
  on booking_pets for insert
  with check (
    exists (
      select 1 from bookings
      where bookings.id = booking_pets.booking_id
        and bookings.owner_id = auth.uid()
    )
  );

grant select, insert on booking_pets to authenticated;

-- Carry forward any existing single-pet bookings.
insert into booking_pets (booking_id, pet_id)
select id, pet_id from bookings where pet_id is not null;

-- The old pets policies (migrations 0006 and 0007) reference bookings.pet_id
-- directly, so they must be dropped BEFORE that column can be removed.
drop policy "Sitters can view pets they're booked to sit for" on pets;
drop policy "Sitters can update meet & greet notes for pets they're booked with" on pets;

alter table bookings drop column pet_id;

-- Recreate both policies against the join table instead.
create policy "Sitters can view pets they're booked to sit for"
  on pets for select
  using (
    exists (
      select 1 from booking_pets
      join bookings on bookings.id = booking_pets.booking_id
      where booking_pets.pet_id = pets.id
        and bookings.sitter_id = auth.uid()
    )
  );

create policy "Sitters can update meet & greet notes for pets they're booked with"
  on pets for update
  using (
    exists (
      select 1 from booking_pets
      join bookings on bookings.id = booking_pets.booking_id
      where booking_pets.pet_id = pets.id
        and bookings.sitter_id = auth.uid()
    )
  );
