-- Several sitter onboarding fields were collected on screen but never
-- actually saved: legal name and date of birth weren't even wired to
-- React state (fully static inputs), and sex, experience, skills, fenced
-- yard, and smokes-indoors were wired to state but silently left out of
-- the final save. Household composition (other pets/people) during home
-- screening had the same problem. All of that is now included in the
-- onboarding save -- these columns hold it.
--
-- Run this once in the Supabase SQL Editor.

alter table profiles
  add column legal_name text,
  add column date_of_birth date,
  add column sex text check (sex in ('Male', 'Female')),
  add column experience_years integer,
  add column skills text[],
  add column household_pets text,
  add column household_people text,
  add column fenced_yard boolean,
  add column smokes_indoors boolean;

grant update (
  legal_name, date_of_birth, sex, experience_years, skills,
  household_pets, household_people, fenced_yard, smokes_indoors
) on profiles to authenticated;
