// Watering plans for the plants on screen: records from plant_waterings plus the plant's own last watering
// (kept for plants watered before v0.1.7 and by older app versions), and the words shown for them.
import { useMemo } from 'react';

import { useWaterings } from './data';
import { shortDay } from './format';
import type { Locale } from './locale';
import type { Plant, Watering } from './types';
import { wateringPlan, type WateringPlan } from './watering';

type T = (ko: string, en: string, ja: string) => string;

export function useWateringPlans() {
  const q = useWaterings();
  const records = useMemo(() => {
    const m = new Map<string, Watering[]>();
    for (const w of q.data ?? []) {
      const list = m.get(w.plant_id) ?? [];
      list.push(w);
      m.set(w.plant_id, list);
    }
    return m;
  }, [q.data]);
  const planOf = (p: Plant) => wateringPlan([...(records.get(p.id) ?? []).map((w) => w.watered_on), p.last_watered_on], p.watering_interval_days);
  return { records, planOf, loading: q.isLoading };
}

const days = (n: number, t: T) => t(`${n}일`, `${n} day${n === 1 ? '' : 's'}`, `${n}日`);

/** The watering line: a small label and one short bold line (kept short so it fits beside the button). */
export function wateringHeadline(plan: WateringPlan, t: T, locale: Locale): { label: string; main: string } {
  if (!plan.count) return { label: t('관수', 'Watering', '水やり'), main: t('아직 기록이 없습니다', 'Nothing recorded yet', 'まだ記録がありません') };
  if (plan.dueIn !== null && plan.next) {
    const label = t('다음 관수 추천', 'Next watering', '次の水やり');
    if (plan.dueIn > 0) return { label, main: t(`${shortDay(plan.next, locale)} · ${plan.dueIn}일 후`, `${shortDay(plan.next, locale)} · in ${days(plan.dueIn, t)}`, `${shortDay(plan.next, locale)} · ${plan.dueIn}日後`) };
    if (plan.dueIn === 0) return { label, main: t('오늘 물 주기 좋은 날', 'Today is the day', '今日が目安の日') };
    return { label, main: t(`${shortDay(plan.next, locale)} · ${-plan.dueIn}일 지남`, `${shortDay(plan.next, locale)} · ${days(-plan.dueIn, t)} late`, `${shortDay(plan.next, locale)} · ${-plan.dueIn}日超過`) };
  }
  return { label: t('마지막 관수', 'Last watered', '最後の水やり'), main: plan.since === 0 ? t('오늘', 'Today', '今日') : t(`${plan.since}일 전`, `${days(plan.since ?? 0, t)} ago`, `${plan.since}日前`) };
}

/** The small line: last watering and where the interval comes from. */
export function wateringDetail(plan: WateringPlan, t: T) {
  if (!plan.count) return t('"주기 리셋"을 누르면 오늘 물 준 것으로 기록됩니다.', 'Tap "Reset" to record a watering today.', '「リセット」で今日の水やりを記録します。');
  const last = plan.since === 0 ? t('마지막 관수 오늘', 'last watered today', '最後の水やり 今日') : t(`마지막 관수 ${plan.since}일 전`, `last watered ${days(plan.since ?? 0, t)} ago`, `最後の水やり ${plan.since}日前`);
  const avg = plan.average !== null ? String(plan.average).replace(/\.0$/, '') : null;
  const why = plan.manual
    ? t(`직접 설정 ${plan.manual}일 주기`, `every ${days(plan.manual, t)} (set by you)`, `${plan.manual}日ごと（手動）`) + (avg ? t(` · 기록 평균 ${avg}일`, ` · records average ${avg} days`, ` · 記録の平均 ${avg}日`) : '')
    : avg
      ? t(`평균 ${avg}일 주기 (기록 ${plan.count}번)`, `average every ${avg} days (${plan.count} records)`, `平均 ${avg}日ごと（記録${plan.count}回）`)
      : t(`기록이 3번 쌓이면 주기를 추천해 드려요 (지금 ${plan.count}번)`, `A suggestion comes after 3 records (now ${plan.count})`, `記録が3回たまると目安を出します（今${plan.count}回）`);
  return `${last} · ${why}`;
}

/** "관수 주기: 자동 (기록 평균)" / "관수 주기: 7일 (직접 설정)" */
export const intervalLabel = (manual: number | null | undefined, t: T) =>
  manual ? t(`관수 주기: ${manual}일 (직접 설정)`, `Interval: ${days(manual, t)} (set by you)`, `水やり間隔：${manual}日（手動）`) : t('관수 주기: 자동 (기록 평균)', 'Interval: automatic (records average)', '水やり間隔：自動（記録の平均）');

/** Small tag for list rows: D-2 / 오늘 / 3일 지남 (today and late are marked). */
export function dueTag(plan: WateringPlan, t: T): { label: string; strong: boolean } | null {
  if (plan.dueIn === null) return null;
  if (plan.dueIn > 0) return { label: `D-${plan.dueIn}`, strong: false };
  if (plan.dueIn === 0) return { label: t('오늘 관수', 'Water today', '今日水やり'), strong: true };
  return { label: t(`${-plan.dueIn}일 지남`, `${-plan.dueIn}d late`, `${-plan.dueIn}日超過`), strong: true };
}
