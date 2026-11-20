import type { Locale } from './locale';
import type { MatterEvent } from './types';

/** Local date as YYYY-MM-DD. */
export function todayStr(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}
export const isDateStr = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const parts = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One date: 2026. 11. 27 / Nov 27, 2026 / 2026年11月27日 */
export function dayLabel(s: string | null | undefined, locale: Locale) {
  if (!s || !isDateStr(s)) return '';
  const a = parts(s);
  if (locale === 'en') return `${MONTHS[a.m - 1]} ${a.d}, ${a.y}`;
  if (locale === 'ja') return `${a.y}年${a.m}月${a.d}日`;
  return `${a.y}. ${a.m}. ${a.d}`;
}

const WEEK = { ko: ['일', '월', '화', '수', '목', '금', '토'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ja: ['日', '月', '火', '水', '木', '金', '土'] };
/** Short day with the weekday: 11월 27일 (금) / Nov 27 (Fri) / 11月27日(金) */
export function shortDay(s: string | null | undefined, locale: Locale) {
  if (!s || !isDateStr(s)) return '';
  const a = parts(s);
  const w = WEEK[locale][new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay()];
  if (locale === 'en') return `${MONTHS[a.m - 1]} ${a.d} (${w})`;
  if (locale === 'ja') return `${a.m}月${a.d}日(${w})`;
  return `${a.m}월 ${a.d}일 (${w})`;
}

/** Event range: "2026. 11. 27~28", "Nov 27–28, 2026", "2026年11月27日〜28日". */
export function eventDate(e: Pick<MatterEvent, 'starts_on' | 'ends_on'>, locale: Locale) {
  const a = parts(e.starts_on);
  const b = e.ends_on && e.ends_on !== e.starts_on ? parts(e.ends_on) : null;
  if (!b) return dayLabel(e.starts_on, locale);
  const sameMonth = b.y === a.y && b.m === a.m;
  if (locale === 'en')
    return sameMonth ? `${MONTHS[a.m - 1]} ${a.d}–${b.d}, ${a.y}` : `${MONTHS[a.m - 1]} ${a.d}, ${a.y} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  if (locale === 'ja') return sameMonth ? `${a.y}年${a.m}月${a.d}日〜${b.d}日` : `${a.y}年${a.m}月${a.d}日〜${b.y !== a.y ? `${b.y}年` : ''}${b.m}月${b.d}日`;
  return sameMonth ? `${a.y}. ${a.m}. ${a.d}~${b.d}` : `${a.y}. ${a.m}. ${a.d} ~ ${b.y !== a.y ? `${b.y}. ` : ''}${b.m}. ${b.d}`;
}

export const eventEnd = (e: Pick<MatterEvent, 'starts_on' | 'ends_on'>) => e.ends_on || e.starts_on;
/** Upcoming (not yet ended), nearest first. */
export const upcomingEvents = <T extends Pick<MatterEvent, 'starts_on' | 'ends_on'>>(list: T[], today = todayStr()) =>
  list.filter((e) => eventEnd(e) >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
/** Past, most recent first. */
export const pastEvents = <T extends Pick<MatterEvent, 'starts_on' | 'ends_on'>>(list: T[], today = todayStr()) =>
  list.filter((e) => eventEnd(e) < today).sort((a, b) => b.starts_on.localeCompare(a.starts_on));

/** "A × B" when both parents are known. */
export const crossName = (seed: string | null | undefined, pollen: string | null | undefined) => {
  const a = (seed ?? '').trim();
  const b = (pollen ?? '').trim();
  return a && b ? `${a} × ${b}` : '';
};

export const safeHttpsUrl = (raw: string | null | undefined) => {
  const v = (raw ?? '').trim();
  if (!v) return '';
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : null;
};

/** Instagram handle from "@name", "name" or a profile URL. */
export const instagramHandle = (raw: string | null | undefined) =>
  (raw ?? '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '');

export const mapsUrl = (address: string, locale: Locale) =>
  locale === 'ko'
    ? `https://map.naver.com/p/search/${encodeURIComponent(address)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const clean = (s: unknown, max = 2000) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/** "14:04" → "오후 2:04" / "2:04 PM" / "午後2:04". */
export function timeLabel(s: string | null | undefined, locale: Locale) {
  const m = (s ?? '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return '';
  const h = Number(m[1]);
  const h12 = h % 12 || 12;
  if (locale === 'en') return `${h12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
  if (locale === 'ja') return `${h < 12 ? '午前' : '午後'}${h12}:${m[2]}`;
  return `${h < 12 ? '오전' : '오후'} ${h12}:${m[2]}`;
}
export const isTimeStr = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const timeStr = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Whole days from `from` (YYYY-MM-DD) to today, by the phone's calendar. */
export function daysSince(from: string | null | undefined, today = todayStr()) {
  if (!from || !isDateStr(from)) return null;
  const [a, b] = [from, today].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}
