// Plant search in My Plants: every word typed must appear somewhere in the name parts, nickname, family,
// shop or the origin (region and country names in Korean, English and Japanese).
import { originLabel } from './geo';
import { LOCALES } from './locale';
import type { Plant } from './types';

const fold = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/['"‘’“”]/g, '')
    .replace(/[›·,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type Searchable = Pick<Plant, 'scientific_name' | 'genus' | 'species' | 'cultivar' | 'nickname'> & Partial<Pick<Plant, 'family' | 'qualifier' | 'shop' | 'origin_region' | 'origin_place'>>;

export function matchesPlant(p: Searchable, query: string) {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const origin = p.origin_region ? LOCALES.map((l) => originLabel(p.origin_region, p.origin_place, l)) : [];
  const hay = fold([p.scientific_name, p.genus, p.qualifier, p.species, p.cultivar, p.nickname, p.family, p.shop, ...origin].filter(Boolean).join(' '));
  // Korean and Japanese place names are written without spaces, so also try the words joined.
  const tight = hay.replace(/ /g, '');
  return words.every((w) => hay.includes(w) || tight.includes(w));
}

/** Newest first; plants without a date keep their name order. */
export const newestFirst = <T extends { created_at?: string; scientific_name: string }>(list: T[]) =>
  [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.scientific_name.localeCompare(b.scientific_name));
