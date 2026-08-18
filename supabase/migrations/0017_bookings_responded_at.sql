-- The Trust Score's Reliability component needs to know how quickly a
-- sitter responds to a request. Nothing on bookings captured that moment
-- before -- only created_at (when the request was made) existed. This adds
-- a nullable timestamp, set once, the first time a sitter accepts or
-- declines a request.
--
-- No new RLS policy or grant is needed -- the existing "Involved parties
-- can update a booking" policy and grant from migration 0002 already cover
-- writing to any column on a booking the sitter is party to.
--
-- Run this once in the Supabase SQL Editor.

alter table bookings add column responded_at timestamptz;
