import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ExpandToggle, Pill, Rule, SummaryTable } from '@/components/detail';
import { MemberGate } from '@/components/gate';
import { AdaptivePhotoPager } from '@/components/photos';
import { ItemRow } from '@/components/rows';
import { usePrompt } from '@/components/prompt';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page, SectionHead, VisibilityField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addWatering, deletePlant, deleteWatering, pathLabel, setPlantPrivate, setWateringInterval, useCategories, usePlants } from '@/lib/data';
import { chooseAsync, confirmAsync, notify } from '@/lib/dialogs';
import { dayLabel, todayStr } from '@/lib/format';
import { placeShort } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel, noCategoryLabel } from '@/lib/labels';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Plant } from '@/lib/types';
import { intervalLabel, useWateringPlans, wateringDetail, wateringHeadline } from '@/lib/use-watering';
import { cleanInterval, daysBetween, INTERVAL_CHOICES } from '@/lib/watering';

const LOG_SHOWN = 10;

export default function PlantDetailScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onEdit={() => router.push(`/plants/edit?id=${id}`)} editTestID="plant-edit" />
      <Page testID="plant-detail">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          <PlantDetail id={id} />
        </MemberGate>
      </Page>
    </View>
  );
}

function PlantDetail({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const { user } = useAuth();
  const prompt = usePrompt();
  const plantsQ = usePlants();
  const plans = useWateringPlans();
  const cats = useCategories().data ?? [];
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);
  const p = plants.find((x) => x.id === id);
  const offspring = plants.filter((x) => x.seed_parent_id === id || x.pollen_parent_id === id);
  const resolve = useSignedUrls([...(p?.photo_paths ?? []), ...offspring.map((o) => o.photo_paths[0])]);
  const [busy, setBusy] = useState(false);
  const [watering, setWatering] = useState(false);
  const [more, setMore] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [allLog, setAllLog] = useState(false);
  if (plantsQ.isLoading) return <Loading />;
  if (!p) return <Notice>{t('이 식물을 찾을 수 없습니다. 삭제되었을 수 있습니다.', 'This plant could not be found. It may have been deleted.', 'この植物が見つかりません。削除された可能性があります。')}</Notice>;

  const parent = (pid: string | null, name: string | null, label: string, testID: string) => {
    if (!name) return null;
    const linked = pid && plants.some((x) => x.id === pid);
    return <InfoRow label={label} value={name} onPress={linked ? () => router.push(`/plants/${pid}`) : undefined} testID={testID} />;
  };
  const togglePrivate = async (v: boolean) => {
    try {
      await setPlantPrivate(p.id, v);
      await qc.invalidateQueries({ queryKey: ['plants'] });
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    }
  };
  const saved = () => Promise.all([qc.invalidateQueries({ queryKey: ['waterings'] }), qc.invalidateQueries({ queryKey: ['plants'] })]);
  const fail = (e: unknown) => notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
  /** Record a watering on `day` (today from "주기 리셋"). */
  const water = async (day = todayStr()) => {
    if (!user) return;
    setWatering(true);
    try {
      await addWatering(user.id, p.id, day);
      await saved();
      setAdding(null);
    } catch (e) {
      fail(e);
    } finally {
      setWatering(false);
    }
  };
  const addPastDay = () => {
    if (!adding) return;
    if (adding > todayStr()) return notify(t('앞으로의 날짜는 기록할 수 없습니다', 'A future day cannot be recorded', '未来の日付は記録できません'));
    water(adding);
  };
  const removeWatering = async (wid: string, day: string) => {
    const ok = await confirmAsync(t(`${dayLabel(day, locale)} 관수 기록을 지울까요?`, `Delete the watering of ${dayLabel(day, locale)}?`, `${dayLabel(day, locale)}の水やり記録を削除しますか？`), '', t('삭제', 'Delete', '削除'), t('취소', 'Cancel', 'キャンセル'), true);
    if (!ok) return;
    try {
      await deleteWatering(wid);
      await saved();
    } catch (e) {
      fail(e);
    }
  };
  const pickInterval = async () => {
    const labels = [t('자동 (기록 평균)', 'Automatic (records average)', '自動（記録の平均）'), ...INTERVAL_CHOICES.map((n) => t(`${n}일`, `${n} days`, `${n}日`)), t('직접 입력…', 'Type a number…', '数字を入力…')];
    const i = await chooseAsync(labels, t('취소', 'Cancel', 'キャンセル'), t('관수 주기', 'Watering interval', '水やり間隔'));
    if (i < 0) return;
    let days: number | null = i === 0 ? null : (INTERVAL_CHOICES[i - 1] ?? null);
    if (i === labels.length - 1) {
      const typed = await prompt({ title: t('관수 주기 (일)', 'Watering interval (days)', '水やり間隔（日）'), placeholder: t('예: 9', 'e.g. 9', '例：9'), initial: p.watering_interval_days ? String(p.watering_interval_days) : '', maxLength: 3 });
      if (!typed) return;
      days = cleanInterval(typed);
      if (days === null) return notify(t('1에서 365 사이의 숫자를 넣어 주세요', 'Enter a number from 1 to 365', '1〜365の数字を入れてください'));
    }
    try {
      await setWateringInterval(p.id, days);
      await saved();
    } catch (e) {
      fail(e);
    }
  };
  const remove = async (plant: Plant) => {
    const ok = await confirmAsync(
      t('이 식물을 삭제할까요?', 'Delete this plant?', 'この植物を削除しますか？'),
      offspring.length ? t('자손 기록에는 부모 이름이 그대로 남습니다.', 'Its offspring keep the parent name.', '子孫の記録には親の名前が残ります。') : '',
      t('삭제', 'Delete', '削除'),
      t('취소', 'Cancel', 'キャンセル'),
      true,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deletePlant(plant);
      await Promise.all([qc.invalidateQueries({ queryKey: ['plants'] }), qc.invalidateQueries({ queryKey: ['categories'] })]);
      router.back();
    } catch (e) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(e));
      setBusy(false);
    }
  };
  const plan = plans.planOf(p);
  const headline = wateringHeadline(plan, t, locale);
  // Newest first; a last watering kept only on the plant (before v0.1.7) shows without a delete button.
  const recorded = [...(plans.records.get(p.id) ?? [])].sort((a, b) => b.watered_on.localeCompare(a.watered_on));
  const log = recorded.length || !p.last_watered_on ? recorded : [{ id: '', plant_id: p.id, watered_on: p.last_watered_on }];

  return (
    <View>
      {p.photo_paths.length > 0 ? (
        <AdaptivePhotoPager flush uris={p.photo_paths.map((x) => resolve(x))} testID="plant-photos-view" />
      ) : (
        <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 6 }}>
          MY PLANTS
        </Txt>
      )}
      <View style={{ paddingHorizontal: 8, marginTop: 6 }}>
        <SummaryTable
          rows={[
            {
              label: t('학명', 'Scientific name', '学名'),
              value: (
                <Txt weight="bold" size={17} style={{ lineHeight: 23 }} testID="plant-title">
                  {p.scientific_name}
                </Txt>
              ),
            },
            { label: t('과', 'Family', '科'), value: p.family, testID: 'plant-info-family' },
            { label: t('동정 상태', 'Species identified', '同定'), value: idStatusLabel(p.identification_status, locale), testID: 'plant-info-status' },
            { label: t('구입처', 'Shop', '購入先'), value: p.shop, testID: 'plant-info-shop' },
          ]}
        />
      </View>
      {!!p.notes && (
        <View style={{ marginTop: 22 }}>
          <Rule dark />
          <Txt size={14} color="#333" style={{ lineHeight: 23, paddingVertical: 20, paddingHorizontal: 8 }} testID="plant-notes-view">
            {p.notes}
          </Txt>
          <Rule dark />
        </View>
      )}
      <View style={[styles.watering, !p.notes && { marginTop: 22, borderTopWidth: 1, borderTopColor: '#9A9A9A', paddingTop: 18 }]} testID="plant-watering">
        <View style={{ flex: 1 }}>
          <View testID="plant-watering-text">
            <Txt size={11} color={C.sub} style={{ letterSpacing: 0.4 }}>
              {headline.label}
            </Txt>
            <Txt weight="bold" size={16} style={{ lineHeight: 22, marginTop: 2 }}>
              {headline.main}
            </Txt>
          </View>
          <Txt size={11} color={C.muted} style={{ lineHeight: 16, marginTop: 4 }} testID="plant-watering-sub">
            {wateringDetail(plan, t)}
          </Txt>
          <Pressable onPress={pickInterval} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 8 }} accessibilityRole="button" testID="plant-interval">
            <Txt size={11} color={C.sub} style={{ textDecorationLine: 'underline' }}>
              {intervalLabel(p.watering_interval_days, t)}
            </Txt>
          </Pressable>
        </View>
        <Pill label={t('주기 리셋', 'Reset', 'リセット')} onPress={() => water()} busy={watering} testID="plant-water" />
      </View>
      <ExpandToggle open={more} onPress={() => setMore(!more)} testID="plant-more" />
      {more && (
        <View testID="plant-more-section">
          <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 6 }}>
            {['MY PLANTS', ...(pathLabel(cats, p.category_id) ? pathLabel(cats, p.category_id).split(' › ') : [noCategoryLabel(t)])].join(' / ')}
          </Txt>
          <InfoRow label={t('카테고리', 'Category', 'カテゴリ')} value={pathLabel(cats, p.category_id) || noCategoryLabel(t)} testID="plant-info-category" />
          <InfoRow label={t('속', 'Genus', '属')} value={p.genus ?? ''} testID="plant-info-genus" />
          <InfoRow label={t('별칭', 'Nickname', '愛称')} value={p.nickname} testID="plant-info-nickname" />
          <InfoRow label={t('원산지', 'Origin', '原産地')} value={placeShort(p.origin_region, p.origin_place, locale)} testID="plant-info-origin" />
          {parent(p.seed_parent_id, p.seed_parent_name, t('모본 (♀)', 'Seed (♀)', '母本 (♀)'), 'plant-info-seed')}
          {parent(p.pollen_parent_id, p.pollen_parent_name, t('부본 (♂)', 'Pollen (♂)', '父本 (♂)'), 'plant-info-pollen')}
          <View testID="watering-log">
            <SectionHead>{t('관수 기록', 'WATERING LOG', '水やりの記録')}</SectionHead>
            {!log.length && (
              <Txt size={12} color={C.muted} style={{ paddingVertical: 10 }}>
                {t('아직 기록이 없습니다.', 'No records yet.', 'まだ記録がありません。')}
              </Txt>
            )}
            {(allLog ? log : log.slice(0, LOG_SHOWN)).map((w, i) => {
              const older = log[i + 1];
              return (
                <View key={w.watered_on} style={styles.logRow} testID={`watering-${w.watered_on}`}>
                  <Txt size={13} style={{ flex: 1 }}>
                    {dayLabel(w.watered_on, locale)}
                  </Txt>
                  {!!older && (
                    <Txt size={11} color={C.muted} style={{ marginRight: 10 }}>
                      {t(`+${daysBetween(older.watered_on, w.watered_on)}일`, `+${daysBetween(older.watered_on, w.watered_on)}d`, `+${daysBetween(older.watered_on, w.watered_on)}日`)}
                    </Txt>
                  )}
                  {!!w.id && (
                    <Pressable onPress={() => removeWatering(w.id, w.watered_on)} hitSlop={8} style={styles.logDelete} accessibilityRole="button" accessibilityLabel={t('기록 삭제', 'Delete record', '記録を削除')} testID={`watering-delete-${w.watered_on}`}>
                      <Txt size={15} color={C.muted}>
                        ×
                      </Txt>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {log.length > LOG_SHOWN && (
              <Pressable onPress={() => setAllLog(!allLog)} hitSlop={6} style={{ paddingVertical: 10 }} accessibilityRole="button" testID="watering-log-all">
                <Txt size={12} color={C.sub} style={{ textDecorationLine: 'underline' }}>
                  {allLog ? t('접기', 'Show fewer', '閉じる') : t(`모두 보기 (${log.length})`, `Show all (${log.length})`, `すべて表示（${log.length}）`)}
                </Txt>
              </Pressable>
            )}
            {adding === null ? (
              <Pressable onPress={() => setAdding(todayStr())} hitSlop={6} style={{ paddingVertical: 12 }} accessibilityRole="button" testID="watering-add">
                <Txt size={13} weight="bold">
                  {t('＋ 다른 날짜 기록', '＋ Record another day', '＋ 別の日を記録')}
                </Txt>
              </Pressable>
            ) : (
              <View style={{ marginTop: 12 }}>
                <DateField label={t('물 준 날', 'Watered on', '水やりした日')} value={adding} onChange={setAdding} testID="watering-date" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button kind="light" label={t('취소', 'Cancel', 'キャンセル')} onPress={() => setAdding(null)} style={{ flex: 1 }} small testID="watering-date-cancel" />
                  <Button label={t('기록', 'Record', '記録')} onPress={addPastDay} busy={watering} style={{ flex: 1 }} small testID="watering-date-save" />
                </View>
              </View>
            )}
          </View>
          {!!offspring.length && (
            <View testID="offspring">
              <SectionHead>{t('이 식물의 자손', 'OFFSPRING', 'この植物の子孫')}</SectionHead>
              {offspring.map((o) => (
                <ItemRow
                  key={o.id}
                  name={o.scientific_name}
                  meta={o.seed_parent_id === id ? t('모본으로 사용', 'as seed parent', '母本として') : t('부본으로 사용', 'as pollen parent', '父本として')}
                  thumb={resolve(o.photo_paths[0])}
                  onPress={() => router.push(`/plants/${o.id}`)}
                  testID={`offspring-${o.id}`}
                />
              ))}
            </View>
          )}
          <View style={{ marginTop: 24 }}>
            <VisibilityField label={t('공개 설정', 'Visibility', '公開設定')} isPrivate={p.is_private} onChange={togglePrivate} testID="plant-visibility-detail" />
          </View>
          <Button kind="danger" label={t('삭제', 'Delete', '削除')} onPress={() => remove(p)} busy={busy} testID="plant-delete" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  watering: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingTop: 22, paddingBottom: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1E1E1' },
  logDelete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
