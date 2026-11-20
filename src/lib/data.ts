import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from './auth';
import { removePhotos } from './photos';
import { MEDIA_BUCKET, supabase, USER_BUCKET } from './supabase';
import { canMoveUnder, childrenOf, depthOf, MAX_DEPTH, nameTaken, plantsDirectlyIn } from './tree';
import type { Category, Find, MatterEvent, MatterShop, Plant, Watering } from './types';

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

// ---------- categories (v0.1.5: made by the user, up to three levels) ----------
// The genus is part of the name only; it no longer decides the category.
const MIGRATION = 'v0.1.7';
/** Turn "column … does not exist" from an old database into a clear message. */
export function schemaHint(e: unknown) {
  const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/schema cache|column .* does not exist|relation .* does not exist|could not find the '.*' column|new row violates row-level security policy for table "plant_categories"/i.test(m))
    return `데이터베이스 업데이트가 필요합니다. Supabase SQL Editor에서 supabase/${MIGRATION}.sql을 실행해 주세요. (Run supabase/${MIGRATION}.sql in the Supabase SQL Editor.)`;
  return m;
}
const failSchema = (error: unknown) => {
  if (error) throw new Error(schemaHint(error));
};
type T = (ko: string, en: string, ja: string) => string;

const cleanName = (raw: string) => raw.replace(/\s+/g, ' ').trim().slice(0, 40);
const exists = (t: T, name: string) => new Error(t(`같은 자리에 "${name}"이(가) 이미 있습니다`, `"${name}" already exists here`, `「${name}」はすでにあります`));

export async function createCategory(uid: string, rawName: string, parentId: string | null, cats: Category[], t: T) {
  const name = cleanName(rawName);
  if (!name) throw new Error(t('이름을 입력해 주세요', 'Enter a name', '名前を入力してください'));
  if (parentId && depthOf(cats, parentId) >= MAX_DEPTH) throw new Error(t('카테고리는 3단계까지 만들 수 있습니다', 'Categories go three levels deep at most', 'カテゴリは3段階までです'));
  if (nameTaken(cats, parentId, name)) throw exists(t, name);
  const sort = childrenOf(cats, parentId).reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
  const { data, error } = await need().from('plant_categories').insert({ owner_id: uid, name, parent_id: parentId, sort_order: sort }).select('id').single();
  failSchema(error);
  return (data as { id: string }).id;
}

export async function renameCategory(cat: Category, rawName: string, cats: Category[], t: T) {
  const name = cleanName(rawName);
  if (!name || name === cat.name) return;
  if (nameTaken(cats, cat.parent_id ?? null, name, cat.id)) throw exists(t, name);
  const { error } = await need().from('plant_categories').update({ name }).eq('id', cat.id);
  failSchema(error);
}

/** Put a category (with what is under it) under another one, or at the top (null). */
export async function moveCategory(cat: Category, newParent: string | null, cats: Category[], t: T) {
  if (!canMoveUnder(cats, cat.id, newParent)) throw new Error(t('그 자리로는 옮길 수 없습니다 (카테고리는 3단계까지)', 'It cannot go there (three levels at most)', 'そこには移動できません（3段階まで）'));
  if (nameTaken(cats, newParent, cat.name, cat.id)) throw exists(t, cat.name);
  const sort = childrenOf(cats, newParent).reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
  const { error } = await need().from('plant_categories').update({ parent_id: newParent, sort_order: sort }).eq('id', cat.id);
  failSchema(error);
}

/** Save a new order of sibling categories. */
export async function reorderCategories(ids: string[]) {
  const db = need();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await db.from('plant_categories').update({ sort_order: (i + 1) * 10 }).eq('id', ids[i]);
    failSchema(error);
  }
}

/**
 * Delete a category. Nothing inside is lost: its plants and its sub-categories move one level up
 * (to the top / 미분류 when it was a 대분류). Names stay unique at the new level.
 */
export async function deleteCategory(cat: Category, cats: Category[], plants: Plant[]) {
  const db = need();
  const up = cat.parent_id ?? null;
  const ids = plantsDirectlyIn(plants, cat.id).map((p) => p.id);
  if (ids.length) {
    const { error } = await db.from('plants').update({ category_id: up }).in('id', ids);
    failSchema(error);
  }
  const kids = childrenOf(cats, cat.id);
  // A child may share the deleted category's name (Orchid › Orchid): free that name first.
  if (kids.some((k) => k.name.toLowerCase() === cat.name.toLowerCase())) {
    const { error } = await db.from('plant_categories').update({ name: `~${cat.id}`.slice(0, 40) }).eq('id', cat.id);
    failSchema(error);
  }
  const taken = new Set(childrenOf(cats, up).filter((c) => c.id !== cat.id).map((c) => c.name.toLowerCase()));
  for (const kid of kids) {
    let name = kid.name;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${kid.name} (${n})`.slice(0, 40);
    taken.add(name.toLowerCase());
    const { error } = await db.from('plant_categories').update({ parent_id: up, name }).eq('id', kid.id);
    failSchema(error);
  }
  const { error } = await db.from('plant_categories').delete().eq('id', cat.id);
  failSchema(error);
}

// ---------- plants ----------
export type PlantInput = Omit<Plant, 'owner_id' | 'created_at' | 'updated_at' | 'sort_order'>;
/** Saves the plant in the category chosen in the form. New plants come first in "직접 정한 순서". */
export async function savePlant(uid: string, row: PlantInput, previous: Plant | null, plants: Plant[]) {
  const db = need();
  const payload = previous ? { ...row, owner_id: uid } : { ...row, owner_id: uid, sort_order: plants.reduce((m, p) => Math.min(m, p.sort_order ?? 0), 0) - 10 };
  const { error } = previous ? await db.from('plants').update(payload).eq('id', row.id) : await db.from('plants').insert(payload);
  failSchema(error);
  const dropped = (previous?.photo_paths ?? []).filter((p) => !row.photo_paths.includes(p));
  await removePhotos(USER_BUCKET, dropped);
}
export async function deletePlant(p: Plant) {
  const { error } = await need().from('plants').delete().eq('id', p.id);
  fail(error);
  await removePhotos(USER_BUCKET, p.photo_paths);
}
/** EDIT: delete several plants (and their photos). */
export async function deletePlants(list: Plant[]) {
  if (!list.length) return;
  const { error } = await need().from('plants').delete().in('id', list.map((p) => p.id));
  fail(error);
  await removePhotos(USER_BUCKET, list.flatMap((p) => p.photo_paths));
}
/** EDIT: move several plants to a category (null = 미분류). */
export async function movePlants(ids: string[], categoryId: string | null) {
  if (!ids.length) return;
  const { error } = await need().from('plants').update({ category_id: categoryId }).in('id', ids);
  failSchema(error);
}
export async function setPlantsPrivate(ids: string[], value: boolean) {
  if (!ids.length) return;
  const { error } = await need().from('plants').update({ is_private: value }).in('id', ids);
  fail(error);
}
/** EDIT: save the dragged order ("직접 정한 순서") of the plants on the page. */
export async function reorderPlants(ids: string[]) {
  const db = need();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await db.from('plants').update({ sort_order: (i + 1) * 10 }).eq('id', ids[i]);
    failSchema(error);
  }
}
/** "주기 리셋": record today's watering. */
// ---------- watering (v0.1.7) ----------
const PAGE = 1000;
/** Watering days of the last ~13 months for all of the user's plants (enough for the averages), newest first. */
export function useWaterings() {
  const { user, member } = useAuth();
  return useQuery({
    queryKey: ['waterings', user?.id],
    enabled: !!user && member === true,
    queryFn: async () => {
      const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
      const out: Watering[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await need().from('plant_waterings').select('id,plant_id,watered_on').eq('owner_id', user!.id).gte('watered_on', since).order('watered_on', { ascending: false }).range(from, from + PAGE - 1);
        // An old database without the table still shows the plants: the last watering then comes from the plant.
        if (error) return out;
        out.push(...((data ?? []) as Watering[]));
        if (!data || data.length < PAGE) return out;
      }
    },
  });
}
/** Record a watering (a second one on the same day is ignored). */
export async function addWatering(uid: string, plantId: string, day: string) {
  const { error } = await need().from('plant_waterings').upsert({ owner_id: uid, plant_id: plantId, watered_on: day }, { onConflict: 'plant_id,watered_on', ignoreDuplicates: true });
  failSchema(error);
}
export async function deleteWatering(id: string) {
  const { error } = await need().from('plant_waterings').delete().eq('id', id);
  failSchema(error);
}
/** Interval set by hand (days), or null for automatic. */
export async function setWateringInterval(plantId: string, days: number | null) {
  const { error } = await need().from('plants').update({ watering_interval_days: days }).eq('id', plantId);
  failSchema(error);
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

// ---------- tree helpers (see tree.ts) ----------
export { childrenOf, pathLabel, plantsUnder, unsortedPlants } from './tree';
