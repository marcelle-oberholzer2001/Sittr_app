-- Foundation tables: profiles, pets, bookings.
-- Run this once in the Supabase SQL Editor.

-- One row per person. Links to Supabase's built-in auth system (auth.users),
-- which handles the actual login/password. This table holds everything else
-- about a person. is_sitter / is_owner both being possible on one row is what
-- makes "one identity, two roles" work.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  is_sitter boolean not null default false,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per pet. Belongs to one owner (a profile), an owner can have many.
create table pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  species text not null,
  size text,
  breed text,
  age text,
  personality text[] not null default '{}',
  feeding text,
  medication text,
  allergies text,
  walking_routine text,
  sleeping_location text,
  behaviour_notes text,
  vet_name text,
  vet_phone text,
  vet_address text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- The core booking record: who, for which pet, what service, what dates,
-- what stage it's at, and the money involved.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  sitter_id uuid not null references profiles(id),
  owner_id uuid not null references profiles(id),
  pet_id uuid not null references pets(id),
  service_type text not null,
  date_from date not null,
  date_to date not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','referred','agreed','paid','completed','cancelled')),
  sitting_fee numeric(10,2) not null,
  platform_fee numeric(10,2) not null,
  total_paid numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: with this on, a table is completely locked until we
-- explicitly say who can see or change what. The policies below say:
alter table profiles enable row level security;
alter table pets enable row level security;
alter table bookings enable row level security;

-- Profiles: publicly viewable (owners need to browse sitter profiles),
-- but only editable by the person it belongs to.
create policy "Profiles are publicly viewable"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Pets: private to the owner for now. Note: per the product spec, a
-- confirmed sitter should also see this once booked (the Sit Clipboard) —
-- we'll add that policy once bookings are wired up for real.
create policy "Owners can view their own pets"
  on pets for select
  using (auth.uid() = owner_id);

create policy "Owners can insert their own pets"
  on pets for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own pets"
  on pets for update
  using (auth.uid() = owner_id);

-- Bookings: visible and manageable only by the sitter or owner involved.
create policy "Involved parties can view a booking"
  on bookings for select
  using (auth.uid() = sitter_id or auth.uid() = owner_id);

create policy "Owners can create a booking request"
  on bookings for insert
  with check (auth.uid() = owner_id);

create policy "Involved parties can update a booking"
  on bookings for update
  using (auth.uid() = sitter_id or auth.uid() = owner_id);
