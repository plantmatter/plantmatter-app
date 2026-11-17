export type Locale = 'ko' | 'en' | 'ja';
export const LOCALES: Locale[] = ['ko', 'en', 'ja'];
export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English', ja: '日本語' };
export const isLocale = (v: unknown): v is Locale => v === 'ko' || v === 'en' || v === 'ja';
/** Pick the string for a locale: tr(locale, '한국어', 'English', '日本語'). */
export const tr = (locale: Locale, ko: string, en: string, ja: string) => (locale === 'en' ? en : locale === 'ja' ? ja : ko);
