-- Real in-app notifications, replacing the 3 hardcoded ones on the home
-- screen. Deliberately triggered from the database itself (via functions
-- below) rather than inserted directly by client code: a notification is
-- always about *someone else's* action (e.g. "your sitter accepted"), so
-- trusting the browser to honestly insert rows on another user's behalf
-- would be a real hole -- anyone could spam anyone else's notification
-- bell. Triggers fire only as a side effect of changes that are themselves
-- already protected by their own table's security rules, so this is safe
-- without needing a special insert policy for regular users at all.
--
-- Covers the events we can actually detect today: a request accepted or
-- declined, a payment received, and a new review. The rest of the product
-- spec's full trigger list (meet & greet reminders, live-update reminders,
-- SOS alerts, payout released) depends on features that don't exist yet,
-- so there's nothing to hook them into -- add them alongside those features
-- later.
--
-- Run this once in the Supabase SQL Editor.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  icon text not null,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on notifications for update
  using (auth.uid() = user_id);

-- No insert grant for anon/authenticated -- rows only ever come from the
-- trigger functions below, which run with elevated privileges.
grant select, update on notifications to authenticated;

create or replace function notify_on_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sitter_name text;
  owner_name text;
begin
  if new.status = old.status then
    return new;
  end if;

  select full_name into sitter_name from profiles where id = new.sitter_id;
  select full_name into owner_name from profiles where id = new.owner_id;

  if new.status = 'accepted' then
    insert into notifications (user_id, icon, text)
    values (new.owner_id, '🎉', coalesce(sitter_name, 'Your sitter') || ' accepted your request');
  elsif new.status = 'declined' then
    insert into notifications (user_id, icon, text)
    values (new.owner_id, '😔', coalesce(sitter_name, 'Your sitter') || ' declined your request');
  elsif new.status = 'paid' then
    insert into notifications (user_id, icon, text)
    values (new.sitter_id, '💰', 'Payment received for your booking with ' || coalesce(owner_name, 'a pet parent'));
  end if;

  return new;
end;
$$;

create trigger booking_status_notify
  after update of status on bookings
  for each row
  execute function notify_on_booking_status_change();

create or replace function notify_on_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer_name text;
begin
  select full_name into reviewer_name from profiles where id = new.reviewer_id;

  insert into notifications (user_id, icon, text)
  values (new.reviewee_id, '⭐', 'New review from ' || coalesce(reviewer_name, 'someone you worked with'));

  return new;
end;
$$;

create trigger review_notify
  after insert on reviews
  for each row
  execute function notify_on_review_insert();
