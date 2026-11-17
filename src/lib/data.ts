import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, type QueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { tr, type Locale } from './locale';
import { removePhotos } from './photos';
import { MEDIA_BUCKET, supabase, USER_BUCKET } from './supabase';
import type { Category, Find, MatterEvent, MatterShop, Plant } from './types';

const need = () => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
};
const fail = (error: unknown) => {
  if (error) throw error;
};

// ---------- reading ----------
export function useCategories() {
  const { user, member } = useAuth();
  return useQuery({
    queryKey: ['categories', user?.id],
    enabled: !!user && member === true,
    queryFn: async () => {
      const { data, error } = await need().from('plant_categories').select('*').eq('owner_id', user!.id).order('sort_order').order('created_at');
      fail(error);
      return (data ?? []) as Category[];
    },
  });
}
export function usePlants() {
  const { user, member } = useAuth();
  return useQuery({
    queryKey: ['plants', user?.id],
    enabled: !!user && member === true,
    queryFn: async () => {
      const { data, error } = await need().from('plants').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false });
      fail(error);
      return (data ?? []) as Plant[];
    },
  });
}
export function useFinds() {
  const { user, member } = useAuth();
  return useQuery({
    queryKey: ['finds', user?.id],
    enabled: !!user && member === true,
    queryFn: async () => {
      const { data, error } = await need().from('finds').select('*').eq('owner_id', user!.id).order('observed_on', { ascending: false });
      fail(error);
      return (data ?? []) as Find[];
    },
  });
}
/** Public lists keep their last good copy on the phone, so HOME still shows posters without signal. */
async function withDeviceCopy<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const fresh = await load();
    AsyncStorage.setItem(key, JSON.stringify(fresh)).catch(() => {});
    return fresh;
  } catch (e) {
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    if (raw) return JSON.parse(raw) as T;
    throw e;
  }
}
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    enabled: !!supabase,
    queryFn: () =>
      withDeviceCopy('pm-cache-events', async () => {
        const { data, error } = await need().from('matter_events').select('*').order('starts_on');
        fail(error);
        return (data ?? []) as MatterEvent[];
      }),
  });
}
export function useShops() {
  return useQuery({
    queryKey: ['shops'],
    enabled: !!supabase,
    queryFn: () =>
      withDeviceCopy('pm-cache-shops', async () => {
        const { data, error } = await need().from('matter_shops').select('*').order('sort_order').order('name');
        fail(error);
        return (data ?? []) as MatterShop[];
      }),
  });
}

// ---------- categories ----------
export const DEFAULT_CATEGORIES = (l: Locale) => [
  'Orchid',
  'Caudex',
  'Jungle Plants',
  'Staghorn Fern',
  'Bromeliad',
  tr(l, '유묘 / 파종', 'Seedlings / Sowing', '実生 / 播種'),
  tr(l, '선인장', 'Cactus', 'サボテン'),
  'Tropical Plants',
  'Tillandsia',
];

let seeding: Promise<void> | null = null;
/** Create the 9 starter categories once per account (in the app language at that moment). */
export function seedCategories(uid: string, locale: Locale, qc: QueryClient) {
  if (seeding) return seeding;
  seeding = (async () => {
    const flag = `pm-cats-seeded-${uid}`;
    if (await AsyncStorage.getItem(flag)) return;
    const db = need();
    const { count, error } = await db.from('plant_categories').select('id', { count: 'exact', head: true }).eq('owner_id', uid);
    fail(error);
    if (!count) {
      const rows = DEFAULT_CATEGORIES(locale).map((name, i) => ({ owner_id: uid, name, sort_order: i * 10 }));
      const ins = await db.from('plant_categories').insert(rows);
      fail(ins.error);
    }
    await AsyncStorage.setItem(flag, '1');
    await qc.invalidateQueries({ queryKey: ['categories'] });
  })().finally(() => {
    seeding = null;
  });
  return seeding;
}

export async function addCategory(uid: string, name: string, parentId: string | null, siblings: Category[]) {
  const sort = siblings.reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
  const { error } = await need().from('plant_categories').insert({ owner_id: uid, name: name.trim().slice(0, 40), parent_id: parentId, sort_order: sort });
  fail(error);
}
export async function renameCategory(id: string, name: string) {
  const { error } = await need().from('plant_categories').update({ name: name.trim().slice(0, 40) }).eq('id', id);
  fail(error);
}
/** Sub-categories go too (ON DELETE CASCADE); plants inside become "unsorted" (SET NULL). */
export async function deleteCategory(id: string) {
  const { error } = await need().from('plant_categories').delete().eq('id', id);
  fail(error);
}

// ---------- plants ----------
export type PlantInput = Omit<Plant, 'owner_id' | 'created_at' | 'updated_at'>;
export async function savePlant(uid: string, row: PlantInput, previous: Plant | null) {
  const db = need();
  const payload = { ...row, owner_id: uid };
  const { error } = previous ? await db.from('plants').update(payload).eq('id', row.id) : await db.from('plants').insert(payload);
  fail(error);
  const dropped = (previous?.photo_paths ?? []).filter((p) => !row.photo_paths.includes(p));
  await removePhotos(USER_BUCKET, dropped);
}
export async function deletePlant(p: Plant) {
  const { error } = await need().from('plants').delete().eq('id', p.id);
  fail(error);
  await removePhotos(USER_BUCKET, p.photo_paths);
}
export async function setPlantPrivate(id: string, value: boolean) {
  const { error } = await need().from('plants').update({ is_private: value }).eq('id', id);
  fail(error);
}

// ---------- finds (online part; offline queue in outbox.ts) ----------
export type FindInput = Omit<Find, 'owner_id' | 'created_at' | 'updated_at'>;
export async function upsertFind(uid: string, row: FindInput) {
  const { error } = await need().from('finds').upsert({ ...row, owner_id: uid }, { onConflict: 'id' });
  fail(error);
}
export async function deleteFindOnline(f: Find) {
  const { error } = await need().from('finds').delete().eq('id', f.id);
  fail(error);
  await removePhotos(USER_BUCKET, f.photo_paths);
}

// ---------- MATTER (admins) ----------
export type EventInput = Omit<MatterEvent, 'created_at' | 'updated_at'>;
export type ShopInput = Omit<MatterShop, 'created_at' | 'updated_at'>;
export async function saveEvent(row: EventInput, previous: MatterEvent | null) {
  const db = need();
  const { error } = previous ? await db.from('matter_events').update(row).eq('id', row.id) : await db.from('matter_events').insert(row);
  fail(error);
  await removePhotos(MEDIA_BUCKET, (previous?.poster_paths ?? []).filter((p) => !row.poster_paths.includes(p)));
}
export async function deleteEvent(e: MatterEvent) {
  const { error } = await need().from('matter_events').delete().eq('id', e.id);
  fail(error);
  await removePhotos(MEDIA_BUCKET, e.poster_paths);
}
export async function saveShop(row: ShopInput, previous: MatterShop | null) {
  const db = need();
  const { error } = previous ? await db.from('matter_shops').update(row).eq('id', row.id) : await db.from('matter_shops').insert(row);
  fail(error);
  await removePhotos(MEDIA_BUCKET, (previous?.photo_paths ?? []).filter((p) => !row.photo_paths.includes(p)));
}
export async function deleteShop(s: MatterShop) {
  const { error } = await need().from('matter_shops').delete().eq('id', s.id);
  fail(error);
  await removePhotos(MEDIA_BUCKET, s.photo_paths);
}

// ---------- tree helpers ----------
const bySort = (a: Category, b: Category) => a.sort_order - b.sort_order || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
export const topCategories = (cats: Category[]) => cats.filter((c) => !c.parent_id).sort(bySort);
export const subCategories = (cats: Category[], id: string) => cats.filter((c) => c.parent_id === id).sort(bySort);
export function categoryPath(cats: Category[], id: string | null | undefined) {
  const c = cats.find((x) => x.id === id);
  if (!c) return '';
  const parent = c.parent_id ? cats.find((x) => x.id === c.parent_id) : null;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}
/** Plants directly in a category plus those in its sub-categories. */
export function countInTop(plants: Plant[], cats: Category[], topId: string) {
  const ids = new Set([topId, ...subCategories(cats, topId).map((s) => s.id)]);
  return plants.filter((p) => p.category_id && ids.has(p.category_id)).length;
}
export const unsortedPlants = (plants: Plant[], cats: Category[]) => {
  const ids = new Set(cats.map((c) => c.id));
  return plants.filter((p) => !p.category_id || !ids.has(p.category_id));
};
