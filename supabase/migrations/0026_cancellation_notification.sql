-- notify_on_booking_status_change() (migration 0010) handles accepted,
-- declined, and paid transitions, but was missing cancelled and completed
-- entirely -- so an owner cancelling a confirmed booking, or either party
-- marking a sit complete, silently notified no one.
--
-- "Completed" can be triggered by either the owner or the sitter (both
-- have their own "Mark sit as complete" button), so this notifies whichever
-- party DIDN'T trigger it, using auth.uid() -- security definer changes
-- the function's execution privileges, not the caller identity the JWT
-- carries, so auth.uid() still reflects who actually made the request.
--
-- Run this once in the Supabase SQL Editor.

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
  elsif new.status = 'cancelled' then
    insert into notifications (user_id, icon, text)
    values (new.sitter_id, '❌', coalesce(owner_name, 'The pet parent') || ' cancelled the booking');
  elsif new.status = 'completed' then
    if auth.uid() = new.owner_id then
      insert into notifications (user_id, icon, text)
      values (new.sitter_id, '✅', coalesce(owner_name, 'The pet parent') || ' marked the sit as complete');
    else
      insert into notifications (user_id, icon, text)
      values (new.owner_id, '✅', coalesce(sitter_name, 'Your sitter') || ' marked the sit as complete');
    end if;
  end if;

  return new;
end;
$$;
