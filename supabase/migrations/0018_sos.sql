-- SOS backup-sitter flow (docs/product_spec.md section 8).
--
-- sos_alerts is deliberately self-contained: the fields a responding sitter
-- needs to decide whether to help (service, dates, pet comfort labels,
-- coverage areas) are copied onto the alert itself at creation time, rather
-- than requiring a browsing sitter to read the underlying `bookings` row --
-- which they have no RLS access to, since they aren't a party to that
-- booking. This keeps matching/browsing simple (any verified sitter can
-- read an open alert) without widening access to real booking details.
--
-- The actual handoff -- reassigning bookings.sitter_id -- is done as a
-- normal update through the existing "Involved parties can update a
-- booking" policy once the owner approves a responder; no new policy is
-- needed for that part.
--
-- Run this once in the Supabase SQL Editor.

create table sos_alerts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  original_sitter_id uuid not null references profiles(id),
  reason text not null,
  service_type text not null,
  date_from date not null,
  date_to date not null,
  pet_summary text not null,
  required_comfort_labels text[] not null default '{}',
  coverage_areas text[] not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'assigned', 'cancelled')),
  assigned_sitter_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table sos_alerts enable row level security;

create policy "Sitters can trigger SOS on their own active booking"
  on sos_alerts for insert
  with check (
    auth.uid() = original_sitter_id
    and exists (
      select 1 from bookings
      where bookings.id = booking_id and bookings.sitter_id = auth.uid()
    )
  );

create policy "Open SOS alerts are visible to sitters; involved parties always"
  on sos_alerts for select
  using (
    status = 'open'
    or auth.uid() = original_sitter_id
    or auth.uid() = assigned_sitter_id
    or exists (
      select 1 from bookings
      where bookings.id = booking_id and bookings.owner_id = auth.uid()
    )
  );

create policy "Owners can resolve SOS alerts on their bookings"
  on sos_alerts for update
  using (
    exists (
      select 1 from bookings
      where bookings.id = booking_id and bookings.owner_id = auth.uid()
    )
  );

grant select, insert, update on sos_alerts to authenticated;


create table sos_responses (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references sos_alerts(id) on delete cascade,
  sitter_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (alert_id, sitter_id)
);

alter table sos_responses enable row level security;

create policy "Sitters can respond to open SOS alerts"
  on sos_responses for insert
  with check (
    auth.uid() = sitter_id
    and exists (
      select 1 from sos_alerts where sos_alerts.id = alert_id and sos_alerts.status = 'open'
    )
  );

create policy "Responders and the involved owner/sitter can view responses"
  on sos_responses for select
  using (
    auth.uid() = sitter_id
    or exists (
      select 1 from sos_alerts
      join bookings on bookings.id = sos_alerts.booking_id
      where sos_alerts.id = alert_id
        and (bookings.owner_id = auth.uid() or sos_alerts.original_sitter_id = auth.uid())
    )
  );

grant select, insert on sos_responses to authenticated;
