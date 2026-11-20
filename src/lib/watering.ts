// Watering: every day a plant was watered is kept; the usual interval comes from those days, and the next
// watering is suggested from it (or from an interval the user set for that plant).
import { isDateStr, todayStr } from './format';

/** How many recent intervals the average looks at. */
export const RECENT = 6;
/** Intervals needed before an average is offered (3 waterings). */
export const MIN_INTERVALS = 2;
/** Interval choices offered in the app (days). */
export const INTERVAL_CHOICES = [3, 5, 7, 10, 14, 21, 30];
export const MAX_INTERVAL = 365;

const dayNumber = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const fromDayNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
export const addDays = (s: string, days: number) => fromDayNumber(dayNumber(s) + days);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

/** Distinct watering days, oldest first. */
export const wateringDays = (days: (string | null | undefined)[]) => [...new Set(days.filter(isDateStr))].sort();

/** Days between consecutive waterings, oldest first. */
export function intervalsOf(days: (string | null | undefined)[]) {
  const list = wateringDays(days);
  return list.slice(1).map((d, i) => daysBetween(list[i], d));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * The usual interval in days (one decimal), from the last {@link RECENT} intervals. A gap of twice the usual or
 * more (a watering that was not recorded) is left out. Null until {@link MIN_INTERVALS} intervals remain.
 */
export function averageInterval(days: (string | null | undefined)[]) {
  const recent = intervalsOf(days).slice(-RECENT);
  if (recent.length < MIN_INTERVALS) return null;
  const usual = median(recent);
  const kept = recent.filter((x) => x < usual * 2);
  if (kept.length < MIN_INTERVALS) return null;
  return Math.round((kept.reduce((a, b) => a + b, 0) / kept.length) * 10) / 10;
}

export type WateringPlan = {
  /** Last watering day, or null. */
  last: string | null;
  /** Days since the last watering (0 = today). */
  since: number | null;
  /** Number of recorded waterings. */
  count: number;
  /** Average interval from the records, or null while there are too few. */
  average: number | null;
  /** The interval set by hand, or null for "automatic". */
  manual: number | null;
  /** Interval used for the suggestion (manual first, else the rounded average), or null. */
  interval: number | null;
  /** Suggested next watering day, or null. */
  next: string | null;
  /** Days until `next`: positive = ahead, 0 = today, negative = days late. */
  dueIn: number | null;
};

export function wateringPlan(days: (string | null | undefined)[], manual: number | null | undefined, today = todayStr()): WateringPlan {
  const list = wateringDays(days);
  const last = list.length ? list[list.length - 1] : null;
  const average = averageInterval(list);
  const set = manual && manual > 0 ? Math.min(Math.round(manual), MAX_INTERVAL) : null;
  const interval = set ?? (average !== null ? Math.max(1, Math.round(average)) : null);
  const next = last && interval ? addDays(last, interval) : null;
  return {
    last,
    since: last ? daysBetween(last, today) : null,
    count: list.length,
    average,
    manual: set,
    interval,
    next,
    dueIn: next ? daysBetween(today, next) : null,
  };
}

/** Clean an interval typed by hand: whole days 1…365, else null. */
export function cleanInterval(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n >= 1 && n <= MAX_INTERVAL ? Math.round(n) : null;
}
