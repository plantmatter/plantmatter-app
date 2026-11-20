-- PLANT MATTER app — database update v0.1.7
-- Run once in the Supabase SQL Editor (after schema.sql). Safe to run again. Nothing is deleted.
-- It contains every update since v0.1 (v0.1.1 – v0.1.7), so this one file is enough.
--   v0.1.1  plants: genus / species / cultivar · observations: genus / species / region · one category per genus
--   v0.1.2  observations: cf. / aff., author, recorded by, locality and coordinates, elevation, occurrence ID
--   v0.1.3  plants: shop, last watering · observations: Found Wild record, measurements, collection & research
--   v0.1.4  family for plants and observations · observations: sp. and an additional name
--   v0.1.5  categories in three levels made by the user · plants: sp./cf./aff. and own order ·
--           an additional name no longer needs sp.
--   v0.1.7  watering records (one per day) and a watering interval per plant

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

-- 13. v0.1.4 · FAMILY, sp. AND THE ADDITIONAL NAME OF OBSERVATIONS ------------------------------------------
-- 과 (family) for plants and observations (not part of the shown name). Observations may now say "sp." on
-- purpose and carry an additional name with it: Selaginella sp. 'Blue'.
alter table public.plants add column if not exists family text not null default '';
alter table public.finds add column if not exists family text not null default '';
alter table public.finds add column if not exists cultivar text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plants_family_length') then
    alter table public.plants add constraint plants_family_length check (char_length(family) <= 60);
  end if;
  -- (v0.1.4 also required sp. for an additional name; v0.1.5 drops that rule, so it is not created here.)
  if not exists (select 1 from pg_constraint where conname = 'finds_family_and_name_v015') then
    alter table public.finds add constraint finds_family_and_name_v015 check (
      char_length(family) <= 60
      and (cultivar is null or char_length(cultivar) <= 100));
  end if;
end $$;
alter table public.finds drop constraint if exists finds_family_and_name_v014;
-- The v0.1.2 rule allowed only cf. / aff.; rebuild it with sp. (same rule otherwise).
alter table public.finds drop constraint if exists finds_field_record;
alter table public.finds add constraint finds_field_record check (
  (qualifier is null or qualifier in ('sp.', 'cf.', 'aff.'))
  and (authority is null or char_length(authority) <= 100)
  and char_length(recorded_by) <= 200
  and char_length(locality) <= 300
  and (latitude is null or latitude between -90 and 90)
  and (longitude is null or longitude between -180 and 180)
  and ((latitude is null) = (longitude is null))
  and (elevation_m is null or elevation_m between -500 and 9000)
  and (occurrence_id is null or occurrence_id ~ '^PM-[0-9]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'));

-- 14. v0.1.5 · CATEGORIES IN THREE LEVELS, sp./cf./aff. AND OWN ORDER FOR PLANTS -----------------------------
-- Categories are made by the user (no longer one per genus): 대분류 › 중분류 › 소분류. A category may sit under
-- any category of the same account, three levels deep at most and never inside itself. Names are unique per
-- level (letter case ignored). Plants get sp./cf./aff. and a position for "my own order".
alter table public.plants add column if not exists qualifier text;
alter table public.plants add column if not exists sort_order integer not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plants_qualifier') then
    alter table public.plants add constraint plants_qualifier check (qualifier is null or qualifier in ('sp.', 'cf.', 'aff.'));
  end if;
end $$;

drop policy if exists "Own categories add" on public.plant_categories;
drop policy if exists "Own categories edit" on public.plant_categories;
create policy "Own categories add" on public.plant_categories for insert to authenticated
  with check (public.is_beta_member() and owner_id = (select auth.uid()) and (parent_id is null or private.owns_category(parent_id)));
create policy "Own categories edit" on public.plant_categories for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (parent_id is null or (parent_id <> id and private.owns_category(parent_id))));

create or replace function private.check_category_tree()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  above integer := 0;   -- levels from the new parent up to the top
  below integer := 0;   -- levels under this category
  cur uuid := new.parent_id;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'A category cannot go inside itself' using errcode = '23514';
    end if;
    above := above + 1;
    if above >= 3 then
      raise exception 'Categories go three levels deep at most' using errcode = '23514';
    end if;
    select c.parent_id into cur from public.plant_categories c where c.id = cur;
  end loop;
  if tg_op = 'UPDATE' then
    with recursive sub(id, lvl) as (
      select c.id, 1 from public.plant_categories c where c.parent_id = new.id
      union all
      select c.id, s.lvl + 1 from public.plant_categories c join sub s on c.parent_id = s.id where s.lvl < 4
    ) select coalesce(max(lvl), 0) into below from sub;
  end if;
  if above + 1 + below > 3 then
    raise exception 'Categories go three levels deep at most' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.check_category_tree() from public;
drop trigger if exists plant_categories_tree on public.plant_categories;
create trigger plant_categories_tree before insert or update of parent_id on public.plant_categories
  for each row execute function private.check_category_tree();

do $$ begin
  create unique index if not exists plant_categories_unique_child
    on public.plant_categories (parent_id, lower(name)) where parent_id is not null;
exception when unique_violation then
  raise notice 'Two sub-categories in one place share a name. Rename one in the app, then run this file again.';
end $$;


-- 15. v0.1.7 · WATERING RECORDS AND INTERVAL -------------------------------------------------------------
-- Every day a plant was watered is kept (one row per plant and day). The app suggests the next watering from
-- the usual interval of these days, or from an interval set by hand (plants.watering_interval_days; empty =
-- automatic). plants.last_watered_on is kept equal to the latest record by a trigger.
alter table public.plants add column if not exists watering_interval_days integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plants_watering_interval') then
    alter table public.plants add constraint plants_watering_interval
      check (watering_interval_days is null or watering_interval_days between 1 and 365);
  end if;
end $$;

create table if not exists public.plant_waterings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  watered_on date not null check (watered_on >= date '2000-01-01'),
  created_at timestamptz not null default now(),
  constraint plant_waterings_one_per_day unique (plant_id, watered_on)
);
create index if not exists plant_waterings_owner on public.plant_waterings(owner_id, watered_on desc);
alter table public.plant_waterings enable row level security;
drop policy if exists "Own waterings read" on public.plant_waterings;
drop policy if exists "Own waterings add" on public.plant_waterings;
drop policy if exists "Own waterings edit" on public.plant_waterings;
drop policy if exists "Own waterings remove" on public.plant_waterings;
create policy "Own waterings read" on public.plant_waterings for select to authenticated using (owner_id = (select auth.uid()));
-- one day of slack for time zones ahead of the server (UTC)
create policy "Own waterings add" on public.plant_waterings for insert to authenticated
  with check (public.is_beta_member() and owner_id = (select auth.uid()) and private.owns_plant(plant_id) and watered_on <= current_date + 1);
create policy "Own waterings edit" on public.plant_waterings for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (public.is_beta_member() and owner_id = (select auth.uid()) and private.owns_plant(plant_id) and watered_on <= current_date + 1);
create policy "Own waterings remove" on public.plant_waterings for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.plant_waterings from anon;
grant select, insert, update, delete on public.plant_waterings to authenticated;

create or replace function private.sync_last_watered()
returns trigger language plpgsql set search_path = '' as $$
declare
  pid uuid;
  latest date;
begin
  foreach pid in array array_remove(array[old.plant_id, new.plant_id], null) loop
    select max(w.watered_on) into latest from public.plant_waterings w where w.plant_id = pid;
    update public.plants p set last_watered_on = latest where p.id = pid and p.last_watered_on is distinct from latest;
  end loop;
  return null;
end $$;
drop trigger if exists plant_waterings_sync on public.plant_waterings;
create trigger plant_waterings_sync after insert or update or delete on public.plant_waterings
  for each row execute function private.sync_last_watered();

-- the one "last watering" kept before v0.1.7 becomes the first record
insert into public.plant_waterings (owner_id, plant_id, watered_on)
  select p.owner_id, p.id, p.last_watered_on from public.plants p where p.last_watered_on is not null
  on conflict (plant_id, watered_on) do nothing;

notify pgrst, 'reload schema';
