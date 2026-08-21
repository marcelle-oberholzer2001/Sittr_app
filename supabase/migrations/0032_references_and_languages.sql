-- References and languages spoken -- flagged twice in the product spec,
-- never built. Both are self-reported (same trust model as the existing
-- "has drivers license" and "background check" fields -- no verification
-- workflow exists yet, this just closes the "collected nowhere" gap).
--
-- Column is named sitter_references, not "references" -- that's a
-- reserved SQL keyword and would require quoting on every query.
--
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column languages_spoken text[],
  add column sitter_references jsonb;

grant update (languages_spoken, sitter_references) on profiles to authenticated;
