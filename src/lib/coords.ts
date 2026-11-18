// Coordinates typed or pasted into an observation: decimal ("6.0753, 116.5583", "6.0753N 116.5583E")
// or degrees-minutes-seconds as map apps copy them (6°04'31.1"N 116°33'29.9"E).

const COORD = /([NSEW])?\s*(-?\d{1,3}(?:\.\d+)?)\s*(?:°\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′’]\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|'')\s*)?)?([NSEW])?/gi;

export type Coords = { lat: number; lon: number };

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function parseCoords(text: string | null | undefined): Coords | null {
  const src = (text ?? '').trim();
  if (!src) return null;
  const found = [...src.matchAll(COORD)].filter((m) => m[2] !== undefined);
  if (found.length !== 2) return null;
  const vals = found.map((m) => {
    const minutes = m[3] ? Number(m[3]) : 0;
    const seconds = m[4] ? Number(m[4]) : 0;
    if (minutes >= 60 || seconds >= 60) return null;
    let v = Math.abs(Number(m[2])) + minutes / 60 + seconds / 3600;
    const hemi = (m[1] || m[5] || '').toUpperCase();
    if (m[2].startsWith('-') || hemi === 'S' || hemi === 'W') v = -v;
    return { v, hemi };
  });
  if (!vals[0] || !vals[1]) return null;
  let [a, b] = vals;
  if ((a.hemi === 'E' || a.hemi === 'W') && (b.hemi === 'N' || b.hemi === 'S')) [a, b] = [b, a];
  if ((a.hemi && 'EW'.includes(a.hemi)) || (b.hemi && 'NS'.includes(b.hemi))) return null;
  const lat = round6(a.v);
  const lon = round6(b.v);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export const formatCoords = (lat: number | null | undefined, lon: number | null | undefined) =>
  lat == null || lon == null ? '' : `${round6(lat)}, ${round6(lon)}`;

/** Elevation in metres from "1800", "1,800 m" or "-20"; null when empty or out of range (-500 to 9000). */
export function parseElevation(text: string | null | undefined): number | null | 'invalid' {
  const src = (text ?? '').replace(/[,\s]/g, '').replace(/m$/i, '');
  if (!src) return null;
  if (!/^-?\d+(\.\d+)?$/.test(src)) return 'invalid';
  const v = Math.round(Number(src));
  return v < -500 || v > 9000 ? 'invalid' : v;
}

/** A decimal number between min and max ("23.5", "1,200"); null when empty. */
export function parseDecimal(text: string | null | undefined, min: number, max: number): number | null | 'invalid' {
  const src = (text ?? '').replace(/[,\s]/g, '');
  if (!src) return null;
  if (!/^-?\d+(\.\d+)?$/.test(src)) return 'invalid';
  const v = Number(src);
  return v < min || v > max ? 'invalid' : Math.round(v * 100) / 100;
}
export const numText = (v: number | null | undefined) => (v == null ? '' : String(v));
