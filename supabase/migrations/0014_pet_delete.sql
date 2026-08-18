-- Pets could be viewed, added, and updated by their owner, but never
-- deleted -- there was simply no policy for it. Needed now that pets can
-- be removed from the "My pets" list.
--
-- Run this once in the Supabase SQL Editor.

create policy "Owners can delete their own pets"
  on pets for delete
  using (auth.uid() = owner_id);

grant delete on pets to authenticated;
