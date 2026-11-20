// Regions → countries / islands. Finds keep a country only; kept plants may stop at a region.
import { AREAS, COUNTRIES, REGIONS, type Names } from '../data/geo';
import type { Locale } from './locale';

const byCountry = new Map(COUNTRIES.map((c) => [c.code, c]));
const byArea = new Map(AREAS.map((a) => [a.id, a]));
const regionByCountry = new Map<string, string>();
for (const r of REGIONS) for (const c of r.countries) regionByCountry.set(c, r.id);

export const nameIn = (n: Names | undefined, locale: Locale) => (n ? n[locale] : '');
export const isCountry = (code: string | null | undefined) => !!code && byCountry.has(code);
export const isArea = (id: string | null | undefined) => !!id && byArea.has(id);
export const regionOf = (place: string | null | undefined): string | null =>
  !place ? null : byArea.get(place)?.region ?? regionByCountry.get(place) ?? null;
export const regionName = (id: string | null | undefined, locale: Locale) => nameIn(REGIONS.find((r) => r.id === id), locale);
export const placeName = (code: string | null | undefined, locale: Locale) =>
  !code ? '' : nameIn(byArea.get(code) ?? byCountry.get(code), locale) || code;

/** "동남아시아 › 보르네오" or just the region. */
export function originLabel(region: string | null | undefined, place: string | null | undefined, locale: Locale) {
  const r = regionName(region, locale);
  if (!r) return '';
  return place ? `${r} › ${placeName(place, locale)}` : r;
}
/**
 * A place as shown in the app (v0.1.8): the last level only — "보르네오", "에콰도르" — or the region when no
 * country / island was chosen ("남아메리카"). The full path stays in search ({@link originLabel}).
 */
export const placeShort = (region: string | null | undefined, place: string | null | undefined, locale: Locale) => (place ? placeName(place, locale) : regionName(region, locale));
/** "말레이시아 · 동남아시아" */
export function countryLabel(code: string | null | undefined, locale: Locale) {
  if (!code) return '';
  const r = regionName(regionOf(code), locale);
  return r ? `${placeName(code, locale)} · ${r}` : placeName(code, locale);
}
/** Where an observation was made: a country, or a whole region ("동남아시아 (지역 전체)"). */
export function findPlaceLabel(region: string | null | undefined, country: string | null | undefined, locale: Locale) {
  if (country) return countryLabel(country, locale);
  const r = regionName(region, locale);
  return r ? `${r} (${({ ko: '지역 전체', en: 'whole region', ja: '地域全体' } as const)[locale]})` : '';
}

export type PlaceChoice = { kind: 'region' | 'area' | 'country'; region: string; place: string | null };
/** origin: region / island / country (kept plants) · find: region or country (observations) · country: country only */
export type PickerMode = 'origin' | 'find' | 'country';

/** Choices listed under a region. Origin mode also offers "whole region" and islands. */
export function choicesIn(region: string, mode: PickerMode): PlaceChoice[] {
  const r = REGIONS.find((x) => x.id === region);
  if (!r) return [];
  const out: PlaceChoice[] = [];
  if (mode !== 'country') out.push({ kind: 'region', region, place: null });
  if (mode === 'origin') for (const a of AREAS) if (a.region === region) out.push({ kind: 'area', region, place: a.id });
  for (const c of r.countries) out.push({ kind: 'country', region, place: c });
  return out;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
/** Search by any of the three names or an alias, e.g. "말레", "borneo", "ボルネオ". */
export function searchPlaces(query: string, mode: PickerMode, limit = 30): PlaceChoice[] {
  const q = norm(query);
  if (!q) return [];
  const hit = (names: string[]) => names.some((n) => norm(n).includes(q));
  const starts = (names: string[]) => names.some((n) => norm(n).startsWith(q));
  const scored: { c: PlaceChoice; score: number }[] = [];
  if (mode !== 'country')
    for (const r of REGIONS) if (hit([r.en, r.ko, r.ja])) scored.push({ c: { kind: 'region', region: r.id, place: null }, score: starts([r.en, r.ko, r.ja]) ? 0 : 2 });
  if (mode === 'origin')
    for (const a of AREAS) if (hit([a.en, a.ko, a.ja, ...a.aliases])) scored.push({ c: { kind: 'area', region: a.region, place: a.id }, score: starts([a.en, a.ko, a.ja]) ? 0 : 2 });
  for (const c of COUNTRIES) {
    const names = [c.en, c.ko, c.ja, ...c.aliases];
    if (!hit(names) && norm(c.code) !== q) continue;
    const region = regionByCountry.get(c.code) ?? '';
    scored.push({ c: { kind: 'country', region, place: c.code }, score: norm(c.code) === q || starts([c.en, c.ko, c.ja]) ? 1 : 3 });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.c);
}

export const choiceKey = (c: PlaceChoice) => `${c.region}:${c.place ?? ''}`;
export const choiceLabel = (c: PlaceChoice, locale: Locale) =>
  c.kind === 'region'
    ? ({ ko: `${regionName(c.region, locale)} 전체`, en: `All of ${regionName(c.region, locale)}`, ja: `${regionName(c.region, locale)}全体` } as const)[locale]
    : placeName(c.place, locale);
