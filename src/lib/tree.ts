// My Plants categories as a tree: 대분류 → 중분류 → 소분류 (at most three levels), all made by the user.
import type { Category, Plant } from './types';

export const MAX_DEPTH = 3;

const bySort = (a: Category, b: Category) => a.sort_order - b.sort_order || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.name.localeCompare(b.name);

/** Categories right under `parentId` (null = the top level), in their order. */
export const childrenOf = (cats: Category[], parentId: string | null) => cats.filter((c) => (c.parent_id ?? null) === parentId).sort(bySort);

/** The category and its ancestors, top first. */
export function chainOf(cats: Category[], id: string | null | undefined): Category[] {
  const out: Category[] = [];
  let cur = cats.find((c) => c.id === id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent_id ? cats.find((c) => c.id === cur!.parent_id) : undefined;
  }
  return out;
}
/** 1 for 대분류, 2 for 중분류, 3 for 소분류; 0 when unknown. */
export const depthOf = (cats: Category[], id: string | null | undefined) => chainOf(cats, id).length;
export const pathLabel = (cats: Category[], id: string | null | undefined) => chainOf(cats, id).map((c) => c.name).join(' › ');

/** The category and everything below it. */
export function subtreeIds(cats: Category[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats)
      if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
  }
  return out;
}
/** Levels below the category (0 when it has no sub-categories). */
export function heightOf(cats: Category[], id: string): number {
  const kids = cats.filter((c) => c.parent_id === id);
  return kids.length ? 1 + Math.max(...kids.map((k) => heightOf(cats, k.id))) : 0;
}

/** Plants in the category or anywhere below it. */
export function plantsUnder(plants: Plant[], cats: Category[], id: string) {
  const ids = subtreeIds(cats, id);
  return plants.filter((p) => p.category_id && ids.has(p.category_id));
}
export const plantsDirectlyIn = (plants: Plant[], id: string) => plants.filter((p) => p.category_id === id);
/** Plants with no category (or one that no longer exists). */
export function unsortedPlants(plants: Plant[], cats: Category[]) {
  const ids = new Set(cats.map((c) => c.id));
  return plants.filter((p) => !p.category_id || !ids.has(p.category_id));
}

const fold = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
/** Another category with this name at the same place (names compare without letter case). */
export const nameTaken = (cats: Category[], parentId: string | null, name: string, exceptId?: string) =>
  cats.some((c) => c.id !== exceptId && (c.parent_id ?? null) === parentId && fold(c.name) === fold(name));

/** Whether `id` (with its sub-categories) may go under `newParent` (null = top): no loops, three levels at most. */
export function canMoveUnder(cats: Category[], id: string, newParent: string | null) {
  if (newParent === id) return false;
  if (newParent && subtreeIds(cats, id).has(newParent)) return false;
  const base = newParent ? depthOf(cats, newParent) : 0;
  return base + 1 + heightOf(cats, id) <= MAX_DEPTH;
}

// ---------- order of plants in a list ----------
export type PlantSort = 'newest' | 'oldest' | 'name' | 'watering' | 'due' | 'manual';
export const PLANT_SORTS: PlantSort[] = ['newest', 'oldest', 'name', 'watering', 'due', 'manual'];

/** `dueIn` (days until the suggested watering, negative = late) is used by 'due'; plants without one go last. */
export function sortPlants<T extends Pick<Plant, 'scientific_name' | 'last_watered_on' | 'sort_order'> & { created_at?: string }>(list: T[], how: PlantSort, dueIn?: (p: T) => number | null): T[] {
  const created = (p: T) => p.created_at ?? '';
  const out = [...list];
  switch (how) {
    case 'oldest':
      return out.sort((a, b) => created(a).localeCompare(created(b)));
    case 'name':
      return out.sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
    case 'watering':
      // never watered first, then the longest ago
      return out.sort((a, b) => (a.last_watered_on ?? '').localeCompare(b.last_watered_on ?? '') || created(b).localeCompare(created(a)));
    case 'due': {
      const due = (p: T) => dueIn?.(p) ?? null;
      return out.sort((a, b) => {
        const [x, y] = [due(a), due(b)];
        if (x !== null && y !== null && x !== y) return x - y;
        if ((x === null) !== (y === null)) return x === null ? 1 : -1;
        return (a.last_watered_on ?? '').localeCompare(b.last_watered_on ?? '') || created(b).localeCompare(created(a));
      });
    }
    case 'manual':
      return out.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || created(b).localeCompare(created(a)));
    default:
      return out.sort((a, b) => created(b).localeCompare(created(a)) || a.scientific_name.localeCompare(b.scientific_name));
  }
}
