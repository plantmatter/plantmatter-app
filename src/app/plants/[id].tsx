import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ExpandToggle, Pill, Rule, SummaryTable } from '@/components/detail';
import { MemberGate } from '@/components/gate';
import { PhotoPager } from '@/components/photos';
import { ItemRow } from '@/components/rows';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page, SectionHead, VisibilityField } from '@/components/ui';
import { categoryPath, deletePlant, setPlantPrivate, setWatered, useCategories, usePlants } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
import { dayLabel, daysSince, todayStr } from '@/lib/format';
import { originLabel } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel } from '@/lib/labels';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Plant } from '@/lib/types';

export default function PlantDetailScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar right={<Pill small label="Edit" onPress={() => router.push(`/plants/edit?id=${id}`)} testID="plant-edit" />} />
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
  const plantsQ = usePlants();
  const cats = useCategories().data ?? [];
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);
  const p = plants.find((x) => x.id === id);
  const offspring = plants.filter((x) => x.seed_parent_id === id || x.pollen_parent_id === id);
  const resolve = useSignedUrls([...(p?.photo_paths ?? []), ...offspring.map((o) => o.photo_paths[0])]);
  const [busy, setBusy] = useState(false);
  const [watering, setWatering] = useState(false);
  const [more, setMore] = useState(false);
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
  const water = async () => {
    setWatering(true);
    try {
      await setWatered(p.id, todayStr());
      await qc.invalidateQueries({ queryKey: ['plants'] });
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setWatering(false);
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
      await deletePlant(plant, cats, plants);
      await Promise.all([qc.invalidateQueries({ queryKey: ['plants'] }), qc.invalidateQueries({ queryKey: ['categories'] })]);
      router.back();
    } catch (e) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(e));
      setBusy(false);
    }
  };
  const days = daysSince(p.last_watered_on);
  const wateringText =
    days === null
      ? t('아직 관수 기록이 없습니다.', 'No watering recorded yet.', 'まだ水やりの記録がありません。')
      : days <= 0
        ? t('오늘 관수했습니다.', 'Watered today.', '今日水やりしました。')
        : t(`마지막 관수 후 ${days}일이 지났습니다.`, `${days} day${days === 1 ? '' : 's'} since the last watering.`, `最後の水やりから${days}日経ちました。`);

  return (
    <View>
      {p.photo_paths.length > 0 ? (
        <PhotoPager flush aspect={1} uris={p.photo_paths.map((x) => resolve(x))} testID="plant-photos-view" />
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
        <Txt size={14} style={{ flex: 1, lineHeight: 21 }} testID="plant-watering-text">
          {wateringText}
        </Txt>
        <Pill label={t('주기 리셋', 'Reset', 'リセット')} onPress={water} busy={watering} testID="plant-water" />
      </View>
      <ExpandToggle open={more} onPress={() => setMore(!more)} testID="plant-more" />
      {more && (
        <View testID="plant-more-section">
          <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 6 }}>
            {['MY PLANTS', categoryPath(cats, p.category_id) || t('미분류', 'Unsorted', '未分類')].join(' / ')}
          </Txt>
          <InfoRow label={t('속', 'Genus', '属')} value={categoryPath(cats, p.category_id) || p.genus || t('미분류', 'Unsorted', '未分類')} testID="plant-info-category" />
          <InfoRow label={t('별칭', 'Nickname', '愛称')} value={p.nickname} testID="plant-info-nickname" />
          <InfoRow label={t('원산지', 'Origin', '原産地')} value={originLabel(p.origin_region, p.origin_place, locale)} testID="plant-info-origin" />
          {parent(p.seed_parent_id, p.seed_parent_name, t('모본 (♀)', 'Seed (♀)', '母本 (♀)'), 'plant-info-seed')}
          {parent(p.pollen_parent_id, p.pollen_parent_name, t('부본 (♂)', 'Pollen (♂)', '父本 (♂)'), 'plant-info-pollen')}
          <InfoRow label={t('마지막 관수', 'Last watered', '最後の水やり')} value={p.last_watered_on ? dayLabel(p.last_watered_on, locale) : ''} testID="plant-info-watered" />
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
});
