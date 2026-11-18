// Scientific names typed in parts: genus (also the My Plants category), species epithet, cultivar / grex.
import { crossName } from './format';
import { tr, type Locale } from './locale';

export const UNIDENTIFIED = 'Unidentified';

/** "bulbophyllum " → "Bulbophyllum"; keeps a leading hybrid sign ("× Doritaenopsis"). */
export function normalizeGenus(raw: string | null | undefined) {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  const hybrid = /^[×x]\s+/i.test(v) ? '× ' : '';
  const body = hybrid ? v.replace(/^[×x]\s+/i, '') : v;
  return (hybrid + body.charAt(0).toUpperCase() + body.slice(1)).slice(0, 60);
}

export const sameGenus = (a: string | null | undefined, b: string | null | undefined) => normalizeGenus(a).toLowerCase() === normalizeGenus(b).toLowerCase() && !!normalizeGenus(a);

/** Strip quotes the user may type around a cultivar name. */
export const cleanCultivar = (raw: string | null | undefined) => (raw ?? '').trim().replace(/^['"‘’“”]+|['"‘’“”]+$/g, '').trim().slice(0, 100);

type Parts = { genus?: string | null; species?: string | null; cultivar?: string | null; seed?: string | null; pollen?: string | null };
/**
 * The name shown everywhere:
 *   Genus species 'Cultivar'  ·  Genus sp.  ·  seed × pollen (a cross without a species name)
 */
export function composeName({ genus, species, cultivar, seed, pollen }: Parts) {
  const g = normalizeGenus(genus);
  const s = (species ?? '').trim().slice(0, 100);
  const c = cleanCultivar(cultivar);
  const quoted = c ? `'${c}'` : '';
  if (!s) {
    const cross = crossName(seed, pollen);
    if (cross) return [cross, quoted].filter(Boolean).join(' ').slice(0, 160);
  }
  if (!g && !s) return quoted ? quoted : '';
  return [g, s || (g ? 'sp.' : ''), quoted].filter(Boolean).join(' ').slice(0, 160);
}

/** Best guess of the parts of a name typed before v0.1.1 (one free text field). */
export function parseName(name: string | null | undefined): { genus: string; species: string; cultivar: string } {
  const v = (name ?? '').trim();
  if (!v || v === UNIDENTIFIED) return { genus: '', species: '', cultivar: '' };
  const quoted = v.match(/['‘’"“”]([^'‘’"“”]+)['‘’"“”]/);
  const cultivar = quoted ? quoted[1].trim() : '';
  const rest = (quoted ? v.replace(quoted[0], '') : v).replace(/\s+/g, ' ').trim();
  const [first = '', second = '', ...more] = rest.split(' ');
  const genus = /^[A-Z][A-Za-z-]+$/.test(first) ? first : '';
  if (!genus) return { genus: '', species: '', cultivar };
  // A cross ("A × B") keeps no species; the parents carry it.
  if (rest.includes(' × ')) return { genus, species: '', cultivar };
  const species = second && second !== 'sp.' && second !== 'sp' ? [second, ...more].join(' ') : '';
  return { genus, species, cultivar };
}

export const displayName = (name: string | null | undefined, l: Locale) =>
  !name || name === UNIDENTIFIED ? tr(l, '이름 모름', 'Unidentified', '名前不明') : name;

// ---------- observations: cf. / aff., authority and botanical typography ----------
export type Qualifier = 'cf.' | 'aff.';
export const QUALIFIERS: Qualifier[] = ['cf.', 'aff.'];
const QUAL_RE = /^(cf|aff)\.?(\s+|$)/i;

/** Author citation as typed ("J.J.Sm."), spaces tidied. */
export const cleanAuthority = (raw: string | null | undefined) => (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);

/** "cf. echinolabium" typed into the species box → qualifier cf. + species echinolabium. */
export function splitQualifier(species: string | null | undefined, qualifier: Qualifier | null | undefined): { species: string; qualifier: Qualifier | null } {
  let s = (species ?? '').replace(/\s+/g, ' ').trim();
  let q: Qualifier | null = qualifier ?? null;
  const m = s.match(QUAL_RE);
  if (m) {
    q = `${m[1].toLowerCase()}.` as Qualifier;
    s = s.slice(m[0].length).trim();
  }
  return { species: s.slice(0, 100), qualifier: s ? q : null };
}

export type NamePiece = { text: string; italic: boolean };
type FindParts = { genus?: string | null; qualifier?: Qualifier | null; species?: string | null; authority?: string | null };

/**
 * Observation name in pieces, typeset the botanical way: genus and epithet in italics; sp., cf., aff. and the
 * author upright. cf./aff. and the author need a species epithet ("Bulbophyllum sp." takes neither).
 *   Bulbophyllum cf. echinolabium J.J.Sm.  ·  Bulbophyllum sp.
 */
export function findNamePieces({ genus, qualifier, species, authority }: FindParts): NamePiece[] {
  const g = normalizeGenus(genus);
  const { species: s, qualifier: q } = splitQualifier(species, qualifier);
  const a = cleanAuthority(authority);
  if (!g && !s) return [];
  const out: NamePiece[] = [];
  if (g) out.push({ text: g, italic: true });
  if (!s) {
    out.push({ text: 'sp.', italic: false });
    return out;
  }
  if (q) out.push({ text: q, italic: false });
  out.push({ text: s, italic: true });
  if (a) out.push({ text: a, italic: false });
  return out;
}
export const piecesText = (pieces: NamePiece[]) => pieces.map((p) => p.text).join(' ');
export const composeFindName = (parts: FindParts) => piecesText(findNamePieces(parts)).slice(0, 160);

const UPRIGHT = new Set(['sp.', 'spp.', 'cf.', 'aff.', 'var.', 'subsp.', 'ssp.', 'f.', '×', 'x']);
/** Pieces of a name stored as one text (observations from before v0.1.2): words in italics except sp., cf., aff. … */
export function piecesOfName(name: string): NamePiece[] {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ text: w, italic: !UPRIGHT.has(w.toLowerCase()) && !/^['‘’"“”(]/.test(w) }));
}
