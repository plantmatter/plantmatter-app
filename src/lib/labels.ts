import { tr, type Locale } from './locale';
import type { IdStatus, ShopKind } from './types';

export const ID_STATUSES: IdStatus[] = ['unidentified', 'proposed', 'verified'];
export const idStatusLabel = (s: IdStatus, l: Locale) =>
  s === 'verified' ? tr(l, '동정 완료', 'Identified', '同定済み') : s === 'proposed' ? tr(l, '동정 중', 'Being identified', '同定中') : tr(l, '미동정', 'Unidentified', '未同定');

export const SHOP_KINDS: ShopKind[] = ['shop', 'showroom', 'greenhouse', 'other'];
export const shopKindLabel = (k: ShopKind, l: Locale) =>
  k === 'showroom' ? tr(l, '쇼룸', 'Showroom', 'ショールーム') : k === 'greenhouse' ? tr(l, '온실·농장', 'Greenhouse · Farm', '温室・農園') : k === 'other' ? tr(l, '기타', 'Other', 'その他') : tr(l, '매장', 'Shop', 'ショップ');
