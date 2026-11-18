-- PLANT MATTER app — database update v0.1.3
-- Run once in the Supabase SQL Editor (after schema.sql). Safe to run again. Nothing is deleted.
-- It contains every update since v0.1 (v0.1.1, v0.1.2 and v0.1.3), so this one file is enough.
--   v0.1.1  plants: genus / species / cultivar · observations: genus / species / region · one category per genus
--   v0.1.2  observations: cf. / aff., author, recorded by, locality and coordinates, elevation, occurrence ID
--   v0.1.3  plants: shop, last watering · observations: time, growth form, substrate, phenology,
--           environmental measurements, collection & research

-- 6. v0.1.1 · PLANTS: NAME PARTS ----------------------------------------------------------------------------------------
alter table public.plants add column if not exists genus text;
alter table public.plants add column if not exists species text;
alter table public.plants add column if not exists cultivar text;

-- 7. v0.1.1 · OBSERVATIONS: NAME PARTS AND REGION ----------------------------------------------------------------------------------
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

-- 8. v0.1.1 · ONE CATEGORY PER GENUS ----------------------------------------------------------------------------
do $$ begin
  create unique index if not exists plant_categories_one_per_genus
    on public.plant_categories (owner_id, lower(name)) where parent_id is null;
exception when unique_violation then
  raise notice 'Two categories of one account share a name. Rename one in the app (that merges them), then run this file again.';
end $$;

-- 9. v0.1.2 · OBSERVATIONS: FIELD RECORD ----------------------------------------------------------------------------
-- cf. / aff., author, recorded by, locality and coordinates (hidden from others by default), elevation.
alter table public.finds add column if not exists qualifier text;
alter table public.finds add column if not exists authority text;
alter table public.finds add column if not exists recorded_by text not null default '';
alter table public.finds add column if not exists locality text not null default '';
alter table public.finds add column if not exists latitude double precision;
alter table public.finds add column if not exists longitude double precision;
alter table public.finds add column if not exists location_private boolean not null default true;
alter table public.finds add column if not exists elevation_m integer;
alter table public.finds add column if not exists occurrence_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'finds_field_record') then
    alter table public.finds add constraint finds_field_record check (
      (qualifier is null or qualifier in ('cf.', 'aff.'))
      and (authority is null or char_length(authority) <= 100)
      and char_length(recorded_by) <= 200
      and char_length(locality) <= 300
      and (latitude is null or latitude between -90 and 90)
      and (longitude is null or longitude between -180 and 180)
      and ((latitude is null) = (longitude is null))
      and (elevation_m is null or elevation_m between -500 and 9000)
      and (occurrence_id is null or occurrence_id ~ '^PM-[0-9]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'));
  end if;
end $$;

-- 10. v0.1.2 · OCCURRENCE ID ------------------------------------------------------------------------------------------
-- PM-<year>-<6 letters/digits without 0, O, 1, I>. The app makes it at the first save (also offline);
-- the database fills in any that is missing and keeps it unchanged afterwards.
create or replace function private.new_occurrence_id(p_year int)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  letters constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
begin
  loop
    candidate := 'PM-' || lpad(least(greatest(p_year, 0), 9999)::text, 4, '0') || '-';
    for i in 1..6 loop
      candidate := candidate || substr(letters, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.finds f where f.occurrence_id = candidate);
  end loop;
  return candidate;
end $$;
revoke all on function private.new_occurrence_id(int) from public;
grant execute on function private.new_occurrence_id(int) to authenticated;

create or replace function private.keep_occurrence_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.occurrence_id is not null then
    new.occurrence_id := old.occurrence_id;
  end if;
  if new.occurrence_id is null then
    new.occurrence_id := private.new_occurrence_id(extract(year from coalesce(new.observed_on, current_date))::int);
  end if;
  return new;
end $$;
drop trigger if exists finds_occurrence_id on public.finds;
create trigger finds_occurrence_id before insert or update on public.finds for each row execute function private.keep_occurrence_id();

update public.finds set occurrence_id = private.new_occurrence_id(extract(year from observed_on)::int) where occurrence_id is null;
create unique index if not exists finds_occurrence_id_key on public.finds (occurrence_id);
alter table public.finds alter column occurrence_id set not null;

-- 11. v0.1.3 · MY PLANTS: SHOP AND WATERING ------------------------------------------------------------------
alter table public.plants add column if not exists shop text not null default '';
alter table public.plants add column if not exists last_watered_on date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plants_shop_length') then
    alter table public.plants add constraint plants_shop_length check (char_length(shop) <= 100);
  end if;
end $$;

-- 12. v0.1.3 · OBSERVATIONS: FOUND WILD, MEASUREMENTS, COLLECTION & RESEARCH -----------------------------------
alter table public.finds add column if not exists observed_time text;
alter table public.finds add column if not exists growth_form text not null default '';
alter table public.finds add column if not exists substrate text not null default '';
alter table public.finds add column if not exists phenology text;
alter table public.finds add column if not exists illuminance_lux numeric;
alter table public.finds add column if not exists ppfd numeric;
alter table public.finds add column if not exists air_temp_c numeric;
alter table public.finds add column if not exists humidity_pct numeric;
alter table public.finds add column if not exists measured_on date;
alter table public.finds add column if not exists measured_time text;
alter table public.finds add column if not exists measurement_basis text;
alter table public.finds add column if not exists measurement_device text not null default '';
alter table public.finds add column if not exists field_number text not null default '';
alter table public.finds add column if not exists abundance text;
alter table public.finds add column if not exists associated_species text not null default '';
alter table public.finds add column if not exists voucher text not null default '';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'finds_field_record_v013') then
    alter table public.finds add constraint finds_field_record_v013 check (
      (observed_time is null or observed_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      and char_length(growth_form) <= 60
      and char_length(substrate) <= 100
      and (phenology is null or phenology in ('vegetative', 'bud', 'flowering', 'fruiting', 'dormant'))
      and (illuminance_lux is null or illuminance_lux between 0 and 200000)
      and (ppfd is null or ppfd between 0 and 3000)
      and (air_temp_c is null or air_temp_c between -50 and 60)
      and (humidity_pct is null or humidity_pct between 0 and 100)
      and (measured_time is null or (measured_on is not null and measured_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
      and (measurement_basis is null or measurement_basis in ('measured', 'weather', 'estimated'))
      and char_length(measurement_device) <= 100
      and char_length(field_number) <= 50
      and (abundance is null or abundance in ('1', '2-10', '11-100', '100+'))
      and char_length(associated_species) <= 300
      and char_length(voucher) <= 200);
  end if;
end $$;

notify pgrst, 'reload schema';
