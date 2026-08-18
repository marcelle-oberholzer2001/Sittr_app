-- Real-time messaging between a parent and sitter, scoped to a specific
-- booking -- not an open inbox where anyone could message any sitter. Only
-- the two people on that booking can see or send messages on it.
--
-- The `alter publication` line is what makes this "live": Supabase Realtime
-- broadcasts row changes for tables added to it, so both people's chat
-- screens update instantly without either of them refreshing.
--
-- Run this once in the Supabase SQL Editor.

create table messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  recipient_id uuid not null references profiles(id),
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "Involved parties can view their messages"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Involved parties can send messages on their own booking"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from bookings
      where bookings.id = messages.booking_id
        and (bookings.owner_id = auth.uid() or bookings.sitter_id = auth.uid())
        and (bookings.owner_id = messages.recipient_id or bookings.sitter_id = messages.recipient_id)
    )
  );

create policy "Recipients can mark their messages read"
  on messages for update
  using (auth.uid() = recipient_id);

grant select, insert, update on messages to authenticated;

alter publication supabase_realtime add table messages;
