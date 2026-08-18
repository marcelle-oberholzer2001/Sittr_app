-- Reviews, tied to a completed booking. Two kinds, matching the two review
-- mockups already built: a parent reviewing a sitter is public (shows on
-- the sitter's profile); a sitter reviewing a parent is private (only the
-- two people involved can see it -- it's a reliability record, not a public
-- callout of an owner). `is_public` picks which rule applies.
--
-- A booking must actually be 'completed' before either side can review --
-- enforced at the database level, not just in the UI, via the insert policy
-- below. `bookings` already supports a 'completed' status; nothing about
-- moving a booking into it is new -- either party (already allowed to
-- update their own bookings) can do it.
--
-- Run this once in the Supabase SQL Editor.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  reviewee_id uuid not null references profiles(id),
  is_public boolean not null,
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id, reviewer_id)
);

alter table reviews enable row level security;

create policy "Public reviews are viewable by everyone"
  on reviews for select
  using (is_public = true);

create policy "Private reviews are viewable by reviewer and reviewee"
  on reviews for select
  using (is_public = false and (auth.uid() = reviewer_id or auth.uid() = reviewee_id));

create policy "Involved parties can leave a review for their own completed booking"
  on reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from bookings
      where bookings.id = reviews.booking_id
        and bookings.status = 'completed'
        and (bookings.owner_id = auth.uid() or bookings.sitter_id = auth.uid())
    )
  );

grant select, insert on reviews to anon, authenticated;
