// Plant name search in My Plants: every word typed must appear somewhere in the name parts or the nickname.
import type { Plant } from './types';

const fold = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/['"‘’“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function matchesPlant(p: Pick<Plant, 'scientific_name' | 'genus' | 'species' | 'cultivar' | 'nickname'>, query: string) {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = fold([p.scientific_name, p.genus, p.species, p.cultivar, p.nickname].filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

/** Newest first; plants without a date keep their name order. */
export const newestFirst = <T extends { created_at?: string; scientific_name: string }>(list: T[]) =>
  [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.scientific_name.localeCompare(b.scientific_name));
