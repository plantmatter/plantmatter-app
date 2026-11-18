import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from './auth';
import { composeName, normalizeGenus, sameGenus } from './names';
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

// ---------- categories = genera ----------
// v0.1.1: a plant's genus is its My Plants category. Typing a new genus creates the category; a genus
// category that no longer holds any plant is removed, so the genus suggestions stay tidy.
const MIGRATION = 'v0.1.1';
/** Turn "column … does not exist" from an old database into a clear message. */
export function schemaHint(e: unknown) {
  const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/schema cache|column .* does not exist|could not find the '.*' column/i.test(m))
    return `데이터베이스 업데이트가 필요합니다. Supabase SQL Editor에서 supabase/${MIGRATION}.sql을 실행해 주세요. (Run supabase/${MIGRATION}.sql in the Supabase SQL Editor.)`;
  return m;
}
const failSchema = (error: unknown) => {
  if (error) throw new Error(schemaHint(error));
};

export const genusCategory = (cats: Category[], genus: string | null | undefined) =>
  cats.find((c) => !c.parent_id && sameGenus(c.name, genus)) ?? null;

/** The category for a genus: the existing one (any letter case) or a new one. */
export async function ensureGenusCategory(uid: string, genus: string, cats: Category[]) {
  const name = normalizeGenus(genus).slice(0, 40);
  const found = genusCategory(cats, name);
  if (found) return found.id;
  const sort = cats.reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
  const { data, error } = await need().from('plant_categories').insert({ owner_id: uid, name, parent_id: null, sort_order: sort }).select('id').single();
  failSchema(error);
  return (data as { id: string }).id;
}

/**
 * Rename a genus category and the genus of every plant in it (fixes a typo everywhere).
 * Renaming to a genus that already has a category merges the two.
 */
export async function renameGenusCategory(cat: Category, newName: string, cats: Category[], plants: Plant[]) {
  const db = need();
  const name = normalizeGenus(newName).slice(0, 40);
  if (!name) return;
  const other = cats.find((c) => c.id !== cat.id && !c.parent_id && sameGenus(c.name, name));
  if (!other) {
    const { error } = await db.from('plant_categories').update({ name }).eq('id', cat.id);
    failSchema(error);
  }
  const target = other ? other.id : cat.id;
  for (const p of plants.filter((x) => x.category_id === cat.id)) {
    const parts = { genus: name, species: p.species, cultivar: p.cultivar, seed: p.seed_parent_name, pollen: p.pollen_parent_name };
    const res = await db.from('plants').update({ genus: name, category_id: target, scientific_name: composeName(parts) || p.scientific_name }).eq('id', p.id);
    failSchema(res.error);
  }
  if (other) await db.from('plant_categories').delete().eq('id', cat.id);
}

/** Remove genus categories that hold no plants any more. */
export async function dropEmptyCategories(cats: Category[], plants: Plant[], keep: string[] = []) {
  const used = new Set(plants.map((p) => p.category_id).filter(Boolean));
  const empty = cats.filter((c) => !used.has(c.id) && !keep.includes(c.id) && !cats.some((x) => x.parent_id === c.id));
  if (!empty.length) return;
  const db = need();
  for (const c of empty) await db.from('plant_categories').delete().eq('id', c.id);
}

// ---------- plants ----------
export type PlantInput = Omit<Plant, 'owner_id' | 'created_at' | 'updated_at' | 'category_id'>;
/** Saves the plant into the category of its genus (created when new), then tidies empty categories. */
export async function savePlant(uid: string, row: PlantInput, previous: Plant | null, cats: Category[], plants: Plant[]) {
  const db = need();
  const category_id = row.genus ? await ensureGenusCategory(uid, row.genus, cats) : null;
  const payload = { ...row, category_id, owner_id: uid };
  const { error } = previous ? await db.from('plants').update(payload).eq('id', row.id) : await db.from('plants').insert(payload);
  failSchema(error);
  const dropped = (previous?.photo_paths ?? []).filter((p) => !row.photo_paths.includes(p));
  await removePhotos(USER_BUCKET, dropped);
  const after = [...plants.filter((p) => p.id !== row.id), { ...(previous ?? ({} as Plant)), ...payload } as Plant];
  await dropEmptyCategories(cats, after, category_id ? [category_id] : []).catch(() => {});
}
export async function deletePlant(p: Plant, cats: Category[], plants: Plant[]) {
  const { error } = await need().from('plants').delete().eq('id', p.id);
  fail(error);
  await removePhotos(USER_BUCKET, p.photo_paths);
  await dropEmptyCategories(cats, plants.filter((x) => x.id !== p.id)).catch(() => {});
}
export async function setPlantPrivate(id: string, value: boolean) {
  const { error } = await need().from('plants').update({ is_private: value }).eq('id', id);
  fail(error);
}

// ---------- finds (online part; offline queue in outbox.ts) ----------
export type FindInput = Omit<Find, 'owner_id' | 'created_at' | 'updated_at'>;
export async function upsertFind(uid: string, row: FindInput) {
  const { error } = await need().from('finds').upsert({ ...row, owner_id: uid }, { onConflict: 'id' });
  failSchema(error);
}
export async function setFindPrivate(id: string, value: boolean) {
  const { error } = await need().from('finds').update({ is_private: value }).eq('id', id);
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
