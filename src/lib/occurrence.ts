// Occurrence ID of an observation (Darwin Core occurrenceID): PM-<year>-<6 letters/digits>, made once and never changed.
// The alphabet leaves out 0/O and 1/I so the code can be read aloud and copied by hand.

export const OCC_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const OCC_RE = /^PM-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export function occurrenceIdFrom(year: number, bytes: Uint8Array) {
  const code = Array.from(bytes.slice(0, 6), (b) => OCC_ALPHABET[b % OCC_ALPHABET.length]).join('');
  return `PM-${String(year).padStart(4, '0').slice(-4)}-${code}`;
}

/** New ID for an observation made on `observedOn` (YYYY-MM-DD); the year falls back to this year. */
export function newOccurrenceId(observedOn: string | null | undefined, randomBytes: (n: number) => Uint8Array) {
  const y = Number((observedOn ?? '').slice(0, 4));
  return occurrenceIdFrom(y >= 1000 && y <= 9999 ? y : new Date().getFullYear(), randomBytes(6));
}
