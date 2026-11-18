-- PLANT MATTER app — database update v0.1.1
-- Run once in the Supabase SQL Editor (after schema.sql). Safe to run again. Nothing is deleted.
--   1) Plants: the name in parts — genus (also the My Plants category), species, cultivar / grex
--   2) Observations: genus / species, and a broad region (a region alone = "whole region")
--   3) One My Plants category per genus and account (letter case ignored)

-- 1. PLANTS ----------------------------------------------------------------------------------------
alter table public.plants add column if not exists genus text;
alter table public.plants add column if not exists species text;
alter table public.plants add column if not exists cultivar text;

-- 2. OBSERVATIONS ----------------------------------------------------------------------------------
alter table public.finds add column if not exists genus text;
alter table public.finds add column if not exists species text;
alter table public.finds add column if not exists region text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plants_name_parts') then
    alter table public.plants add constraint plants_name_parts check (
      (genus is null or char_length(btrim(genus)) between 1 and 60)
      and (species is null or char_length(species) <= 100)
      and (cultivar is null or char_length(cultivar) <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finds_name_and_region') then
    alter table public.finds add constraint finds_name_and_region check (
      (genus is null or char_length(btrim(genus)) between 1 and 60)
      and (species is null or char_length(species) <= 100)
      and (region is null or region ~ '^[a-z_]{2,30}$'));
  end if;
end $$;

-- 3. ONE CATEGORY PER GENUS ----------------------------------------------------------------------------
do $$ begin
  create unique index if not exists plant_categories_one_per_genus
    on public.plant_categories (owner_id, lower(name)) where parent_id is null;
exception when unique_violation then
  raise notice 'Two categories of one account share a name. Rename one in the app (that merges them), then run this file again.';
end $$;

notify pgrst, 'reload schema';
