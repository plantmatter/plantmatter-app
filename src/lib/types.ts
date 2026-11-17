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
  scientific_name: string;
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
  created_at?: string;
  updated_at?: string;
};

export type Find = {
  id: string;
  owner_id: string;
  scientific_name: string;
  identification_status: IdStatus;
  country_code: string | null;
  observed_on: string;
  habitat: string;
  notes: string;
  photo_paths: string[];
  is_private: boolean;
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
