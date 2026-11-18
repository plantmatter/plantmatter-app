import { tr, type Locale } from './locale';
import type { IdStatus, ShopKind } from './types';

export const ID_STATUSES: IdStatus[] = ['unidentified', 'proposed', 'verified'];
export const idStatusLabel = (s: IdStatus, l: Locale) =>
  s === 'verified' ? tr(l, '동정 완료', 'Identified', '同定済み') : s === 'proposed' ? tr(l, '동정 중', 'Being identified', '同定中') : tr(l, '미동정', 'Unidentified', '未同定');

export const SHOP_KINDS: ShopKind[] = ['shop', 'showroom', 'greenhouse', 'other'];
export const shopKindLabel = (k: ShopKind, l: Locale) =>
  k === 'showroom' ? tr(l, '쇼룸', 'Showroom', 'ショールーム') : k === 'greenhouse' ? tr(l, '온실·농장', 'Greenhouse · Farm', '温室・農園') : k === 'other' ? tr(l, '기타', 'Other', 'その他') : tr(l, '매장', 'Shop', 'ショップ');

// ---------- observation field record (v0.1.3) ----------
type Preset = { value: string; ko: string; en: string; ja: string };
const pick = (list: Preset[], v: string | null | undefined, l: Locale) => {
  const p = list.find((x) => x.value === v);
  return p ? tr(l, p.ko, p.en, p.ja) : (v ?? '');
};

/** 생육 형태. Anything else typed by hand is kept as text. */
export const GROWTH_FORMS: Preset[] = [
  { value: 'epiphytic', ko: '착생', en: 'Epiphytic', ja: '着生' },
  { value: 'terrestrial', ko: '지생', en: 'Terrestrial', ja: '地生' },
  { value: 'lithophytic', ko: '암생', en: 'Lithophytic', ja: '岩生' },
  { value: 'climbing', ko: '덩굴', en: 'Climbing', ja: 'つる性' },
  { value: 'aquatic', ko: '수생', en: 'Aquatic', ja: '水生' },
];
export const growthFormLabel = (v: string | null | undefined, l: Locale) => pick(GROWTH_FORMS, v, l);

/** 생육 상태 (phenology). */
export const PHENOLOGY: Preset[] = [
  { value: 'vegetative', ko: '영양 생장', en: 'Vegetative', ja: '栄養成長' },
  { value: 'bud', ko: '꽃봉오리', en: 'In bud', ja: 'つぼみ' },
  { value: 'flowering', ko: '개화', en: 'Flowering', ja: '開花' },
  { value: 'fruiting', ko: '결실', en: 'Fruiting', ja: '結実' },
  { value: 'dormant', ko: '휴면', en: 'Dormant', ja: '休眠' },
];
export const phenologyLabel = (v: string | null | undefined, l: Locale) => pick(PHENOLOGY, v, l);

/** 측정 근거. */
export const MEASUREMENT_BASES: Preset[] = [
  { value: 'measured', ko: '실측', en: 'Measured', ja: '実測' },
  { value: 'weather', ko: '기상 자료', en: 'Weather data', ja: '気象データ' },
  { value: 'estimated', ko: '추정', en: 'Estimated', ja: '推定' },
];
export const basisLabel = (v: string | null | undefined, l: Locale) => pick(MEASUREMENT_BASES, v, l);

/** 개체군 (abundance). */
export const ABUNDANCE: Preset[] = [
  { value: '1', ko: '1', en: '1', ja: '1' },
  { value: '2-10', ko: '2–10', en: '2–10', ja: '2–10' },
  { value: '11-100', ko: '11–100', en: '11–100', ja: '11–100' },
  { value: '100+', ko: '100 이상', en: '100+', ja: '100以上' },
];
export const abundanceLabel = (v: string | null | undefined, l: Locale) => pick(ABUNDANCE, v, l);
export const presetText = (p: Preset, l: Locale) => tr(l, p.ko, p.en, p.ja);
export type { Preset };
