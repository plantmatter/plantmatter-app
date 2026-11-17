-- PLANT MATTER app — database schema v0.1
-- Run once in a NEW Supabase project: SQL Editor → paste everything → Run. Safe to run again.
--
-- What it creates
--   profiles          display name and terms agreement (one row per account)
--   beta_invites      e-mail addresses allowed to use the beta (managed here, in the SQL Editor)
--   app_admins        accounts that may post MATTER events and shops (managed here)
--   plant_categories  "My Plants" categories, two levels
--   plants            kept plants (category, origin, seed / pollen parents, photos)
--   finds             plants found in the wild (country only — no coordinates)
--   matter_events     plant events (anyone can read, admins write)
--   matter_shops      shops and showrooms (anyone can read, admins write)
--   storage           user-photos (private, owner only) and matter-media (public posters, admins upload)
--
-- v0.1 has no sharing between members yet: plants and finds are visible to their owner only.

-- 0. HELPERS --------------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.beta_invites (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  note text not null default '',
  invited_at timestamptz not null default now()
);
alter table public.beta_invites enable row level security;
revoke all on public.beta_invites from anon, authenticated;

create or replace function private.is_beta_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.beta_invites i where i.email = lower((select auth.jwt()) ->> 'email'));
$$;
revoke all on function private.is_beta_member() from public;
grant execute on function private.is_beta_member() to authenticated;
create or replace function public.is_beta_member()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_beta_member();
$$;
revoke all on function public.is_beta_member() from public;
grant execute on function public.is_beta_member() to authenticated;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- 1. PROFILES -------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Own profile read" on public.profiles;
drop policy if exists "Own profile insert" on public.profiles;
drop policy if exists "Own profile update" on public.profiles;
create policy "Own profile read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Own profile insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Own profile update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();

-- 2. MY PLANTS ------------------------------------------------------------------------------------
create table if not exists public.plant_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references public.plant_categories(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plant_categories_owner on public.plant_categories(owner_id, sort_order);
alter table public.plant_categories enable row level security;
-- Policies on a table cannot query the same table, so ownership checks go through definer functions.
create or replace function private.owns_top_category(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plant_categories c where c.id = p_id and c.owner_id = (select auth.uid()) and c.parent_id is null);
$$;
create or replace function private.owns_category(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plant_categories c where c.id = p_id and c.owner_id = (select auth.uid()));
$$;
revoke all on function private.owns_top_category(uuid), private.owns_category(uuid) from public;
grant execute on function private.owns_top_category(uuid), private.owns_category(uuid) to authenticated;
drop policy if exists "Own categories read" on public.plant_categories;
drop policy if exists "Own categories add" on public.plant_categories;
drop policy if exists "Own categories edit" on public.plant_categories;
drop policy if exists "Own categories remove" on public.plant_categories;
create policy "Own categories read" on public.plant_categories for select to authenticated using (owner_id = (select auth.uid()));
-- A sub-category must sit under one of your own top-level categories (two levels at most).
create policy "Own categories add" on public.plant_categories for insert to authenticated
  with check (public.is_beta_member() and owner_id = (select auth.uid()) and (parent_id is null or private.owns_top_category(parent_id)));
create policy "Own categories edit" on public.plant_categories for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (parent_id is null or (parent_id <> id and private.owns_top_category(parent_id))));
create policy "Own categories remove" on public.plant_categories for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.plant_categories from anon;
grant select, insert, update, delete on public.plant_categories to authenticated;

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.plant_categories(id) on delete set null,
  scientific_name text not null check (char_length(btrim(scientific_name)) between 1 and 160),
  nickname text not null default '' check (char_length(nickname) <= 80),
  identification_status text not null default 'unidentified' check (identification_status in ('unidentified', 'proposed', 'verified')),
  origin_region text check (origin_region is null or origin_region ~ '^[a-z_]{2,30}$'),
  origin_place text check (origin_place is null or origin_place ~ '^([A-Z]{2}|[a-z_]{2,30})$'),
  seed_parent_id uuid references public.plants(id) on delete set null,
  seed_parent_name text check (seed_parent_name is null or char_length(seed_parent_name) <= 160),
  pollen_parent_id uuid references public.plants(id) on delete set null,
  pollen_parent_name text check (pollen_parent_name is null or char_length(pollen_parent_name) <= 160),
  notes text not null default '' check (char_length(notes) <= 2000),
  photo_paths text[] not null default '{}' check (coalesce(array_length(photo_paths, 1), 0) <= 5),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plants_place_needs_region check (origin_place is null or origin_region is not null),
  constraint plants_not_own_parent check (seed_parent_id is distinct from id and pollen_parent_id is distinct from id)
);
create index if not exists plants_owner on public.plants(owner_id, created_at desc);
create index if not exists plants_category on public.plants(category_id) where category_id is not null;
create index if not exists plants_seed_parent on public.plants(seed_parent_id) where seed_parent_id is not null;
create index if not exists plants_pollen_parent on public.plants(pollen_parent_id) where pollen_parent_id is not null;
create or replace function private.owns_plant(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plants p where p.id = p_id and p.owner_id = (select auth.uid()));
$$;
revoke all on function private.owns_plant(uuid) from public;
grant execute on function private.owns_plant(uuid) to authenticated;
alter table public.plants enable row level security;
drop policy if exists "Own plants read" on public.plants;
drop policy if exists "Own plants add" on public.plants;
drop policy if exists "Own plants edit" on public.plants;
drop policy if exists "Own plants remove" on public.plants;
create policy "Own plants read" on public.plants for select to authenticated using (owner_id = (select auth.uid()));
create policy "Own plants add" on public.plants for insert to authenticated
  with check (public.is_beta_member() and owner_id = (select auth.uid())
    and (category_id is null or private.owns_category(category_id))
    and (seed_parent_id is null or private.owns_plant(seed_parent_id))
    and (pollen_parent_id is null or private.owns_plant(pollen_parent_id)));
create policy "Own plants edit" on public.plants for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (public.is_beta_member() and owner_id = (select auth.uid())
    and (category_id is null or private.owns_category(category_id))
    and (seed_parent_id is null or private.owns_plant(seed_parent_id))
    and (pollen_parent_id is null or private.owns_plant(pollen_parent_id)));
create policy "Own plants remove" on public.plants for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.plants from anon;
grant select, insert, update, delete on public.plants to authenticated;
drop trigger if exists plants_touch on public.plants;
create trigger plants_touch before update on public.plants for each row execute function private.touch_updated_at();

-- 3. WILD FINDS (country only) ----------------------------------------------------------------------
create table if not exists public.finds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scientific_name text not null check (char_length(btrim(scientific_name)) between 1 and 160),
  identification_status text not null default 'unidentified' check (identification_status in ('unidentified', 'proposed', 'verified')),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  observed_on date not null default current_date,
  habitat text not null default '' check (char_length(habitat) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  photo_paths text[] not null default '{}' check (coalesce(array_length(photo_paths, 1), 0) <= 5),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finds_owner on public.finds(owner_id, observed_on desc);
alter table public.finds enable row level security;
drop policy if exists "Own finds read" on public.finds;
drop policy if exists "Own finds add" on public.finds;
drop policy if exists "Own finds edit" on public.finds;
drop policy if exists "Own finds remove" on public.finds;
create policy "Own finds read" on public.finds for select to authenticated using (owner_id = (select auth.uid()));
create policy "Own finds add" on public.finds for insert to authenticated with check (public.is_beta_member() and owner_id = (select auth.uid()));
create policy "Own finds edit" on public.finds for update to authenticated using (owner_id = (select auth.uid())) with check (public.is_beta_member() and owner_id = (select auth.uid()));
create policy "Own finds remove" on public.finds for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.finds from anon;
grant select, insert, update, delete on public.finds to authenticated;
drop trigger if exists finds_touch on public.finds;
create trigger finds_touch before update on public.finds for each row execute function private.touch_updated_at();

-- 4. MATTER: EVENTS AND SHOPS ------------------------------------------------------------------------
create table if not exists public.matter_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  subtitle text not null default '' check (char_length(subtitle) <= 80),
  starts_on date not null,
  ends_on date,
  venue text not null default '' check (char_length(venue) <= 160),
  description text not null default '' check (char_length(description) <= 2000),
  link_url text not null default '' check (link_url = '' or (link_url ~* '^https?://[^[:space:]]+$' and char_length(link_url) <= 500)),
  poster_paths text[] not null default '{}' check (coalesce(array_length(poster_paths, 1), 0) <= 6),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_events_dates check (ends_on is null or ends_on >= starts_on)
);
create index if not exists matter_events_by_date on public.matter_events(starts_on);
create table if not exists public.matter_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null default 'shop' check (kind in ('shop', 'showroom', 'greenhouse', 'other')),
  area text not null default '' check (char_length(area) <= 80),
  address text not null default '' check (char_length(address) <= 200),
  hours text not null default '' check (char_length(hours) <= 200),
  phone text not null default '' check (char_length(phone) <= 40),
  instagram text not null default '' check (char_length(instagram) <= 80),
  website text not null default '' check (website = '' or (website ~* '^https?://[^[:space:]]+$' and char_length(website) <= 300)),
  description text not null default '' check (char_length(description) <= 2000),
  photo_paths text[] not null default '{}' check (coalesce(array_length(photo_paths, 1), 0) <= 10),
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.matter_events enable row level security;
alter table public.matter_shops enable row level security;
drop policy if exists "Anyone reads events" on public.matter_events;
drop policy if exists "Admins add events" on public.matter_events;
drop policy if exists "Admins edit events" on public.matter_events;
drop policy if exists "Admins remove events" on public.matter_events;
create policy "Anyone reads events" on public.matter_events for select to anon, authenticated using (true);
create policy "Admins add events" on public.matter_events for insert to authenticated with check (public.is_app_admin());
create policy "Admins edit events" on public.matter_events for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "Admins remove events" on public.matter_events for delete to authenticated using (public.is_app_admin());
drop policy if exists "Anyone reads shops" on public.matter_shops;
drop policy if exists "Admins add shops" on public.matter_shops;
drop policy if exists "Admins edit shops" on public.matter_shops;
drop policy if exists "Admins remove shops" on public.matter_shops;
create policy "Anyone reads shops" on public.matter_shops for select to anon, authenticated using (true);
create policy "Admins add shops" on public.matter_shops for insert to authenticated with check (public.is_app_admin());
create policy "Admins edit shops" on public.matter_shops for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "Admins remove shops" on public.matter_shops for delete to authenticated using (public.is_app_admin());
grant select on public.matter_events, public.matter_shops to anon, authenticated;
grant insert, update, delete on public.matter_events, public.matter_shops to authenticated;
drop trigger if exists matter_events_touch on public.matter_events;
create trigger matter_events_touch before update on public.matter_events for each row execute function private.touch_updated_at();
drop trigger if exists matter_shops_touch on public.matter_shops;
create trigger matter_shops_touch before update on public.matter_shops for each row execute function private.touch_updated_at();

-- 5. STORAGE ----------------------------------------------------------------------------------------
-- user-photos: private. Files live under "<your user id>/…" and only you can read or change them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('user-photos', 'user-photos', false, 5242880, array['image/jpeg'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- matter-media: public posters and shop photos (anyone can open them by URL). Only admins upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('matter-media', 'matter-media', true, 10485760, array['image/jpeg'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Own photos read" on storage.objects;
drop policy if exists "Own photos add" on storage.objects;
drop policy if exists "Own photos update" on storage.objects;
drop policy if exists "Own photos remove" on storage.objects;
create policy "Own photos read" on storage.objects for select to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own photos add" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_beta_member());
create policy "Own photos update" on storage.objects for update to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own photos remove" on storage.objects for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Anyone reads matter media" on storage.objects;
drop policy if exists "Admins add matter media" on storage.objects;
drop policy if exists "Admins update matter media" on storage.objects;
drop policy if exists "Admins remove matter media" on storage.objects;
create policy "Anyone reads matter media" on storage.objects for select to anon, authenticated using (bucket_id = 'matter-media');
create policy "Admins add matter media" on storage.objects for insert to authenticated with check (bucket_id = 'matter-media' and public.is_app_admin());
create policy "Admins update matter media" on storage.objects for update to authenticated
  using (bucket_id = 'matter-media' and public.is_app_admin()) with check (bucket_id = 'matter-media' and public.is_app_admin());
create policy "Admins remove matter media" on storage.objects for delete to authenticated using (bucket_id = 'matter-media' and public.is_app_admin());

notify pgrst, 'reload schema';

-- AFTER RUNNING ---------------------------------------------------------------------------------------
-- 1) Invite testers (one line per e-mail, lower case):
--    insert into public.beta_invites (email) values ('tester@example.com') on conflict do nothing;
-- 2) Make an account an admin (after that person has signed up in the app):
--    insert into public.app_admins (user_id) select id from auth.users where lower(email) = lower('OFFICIAL_EMAIL') on conflict do nothing;
-- 3) Check:
--    select email from public.beta_invites order by invited_at;
--    select u.email from public.app_admins a join auth.users u on u.id = a.user_id;
