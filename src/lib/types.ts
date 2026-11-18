// Rows as stored in Supabase (see supabase/schema.sql).
export type IdStatus = 'unidentified' | 'proposed' | 'verified';

export type Profile = {
  id: string;
  display_name: string;
  terms_accepted_at: string | null;
  created_at?: string;
};

export type Category = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at?: string;
};

export type Plant = {
  id: string;
  owner_id: string;
  category_id: string | null;
  /** Shown name, composed from genus / species / cultivar (or "seed × pollen"). */
  scientific_name: string;
  /** Family (v0.1.4); not part of the shown name. */
  family: string;
  genus: string | null;
  species: string | null;
  cultivar: string | null;
  nickname: string;
  identification_status: IdStatus;
  origin_region: string | null;
  origin_place: string | null;
  seed_parent_id: string | null;
  seed_parent_name: string | null;
  pollen_parent_id: string | null;
  pollen_parent_name: string | null;
  notes: string;
  photo_paths: string[];
  is_private: boolean;
  /** Where it was bought (v0.1.3). */
  shop: string;
  /** Last watering (v0.1.3); "주기 리셋" sets it to today. */
  last_watered_on: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Find = {
  id: string;
  owner_id: string;
  /** Full name as shown, author included ("Bulbophyllum cf. echinolabium J.J.Sm."). */
  scientific_name: string;
  /** Family (v0.1.4); not part of the shown name. */
  family: string;
  genus: string | null;
  /** sp. (v0.1.4) / cf. / aff. (v0.1.2). */
  qualifier: 'sp.' | 'cf.' | 'aff.' | null;
  /** Additional name with sp. (v0.1.4): Selaginella sp. 'Blue'. */
  cultivar: string | null;
  species: string | null;
  /** Author citation of the name (v0.1.2). */
  authority: string | null;
  identification_status: IdStatus;
  /** Recorded By (v0.1.2). */
  recorded_by: string;
  /** Broad region; set alone when only the region is known ("all of Southeast Asia"). */
  region: string | null;
  country_code: string | null;
  /** Locality in words and coordinates (WGS84), private unless the owner opens them (v0.1.2). */
  locality: string;
  latitude: number | null;
  longitude: number | null;
  location_private: boolean;
  elevation_m: number | null;
  observed_on: string;
  habitat: string;
  notes: string;
  photo_paths: string[];
  is_private: boolean;
  /** PM-2026-7K3QX9, made at the first save and never changed (v0.1.2). */
  occurrence_id: string | null;
  // ---- v0.1.3: field record ----
  observed_time: string | null;
  /** A GROWTH_FORMS value or text typed by hand. */
  growth_form: string;
  substrate: string;
  phenology: string | null;
  illuminance_lux: number | null;
  ppfd: number | null;
  air_temp_c: number | null;
  humidity_pct: number | null;
  measured_on: string | null;
  measured_time: string | null;
  measurement_basis: string | null;
  measurement_device: string;
  field_number: string;
  abundance: string | null;
  associated_species: string;
  voucher: string;
  created_at?: string;
  updated_at?: string;
};

export type MatterEvent = {
  id: string;
  title: string;
  subtitle: string;
  starts_on: string;
  ends_on: string | null;
  venue: string;
  description: string;
  link_url: string;
  poster_paths: string[];
  created_at?: string;
  updated_at?: string;
};

export type ShopKind = 'shop' | 'showroom' | 'greenhouse' | 'other';
export type MatterShop = {
  id: string;
  name: string;
  kind: ShopKind;
  area: string;
  address: string;
  hours: string;
  phone: string;
  instagram: string;
  website: string;
  description: string;
  photo_paths: string[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export const PLANT_PHOTO_LIMIT = 5;
export const FIND_PHOTO_LIMIT = 5;
export const POSTER_LIMIT = 6;
export const SHOP_PHOTO_LIMIT = 10;
