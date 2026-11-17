import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { PhotoPager } from '@/components/photos';
import { ItemRow } from '@/components/rows';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page, SectionHead, ToggleRow } from '@/components/ui';
import { categoryPath, deletePlant, setPlantPrivate, useCategories, usePlants } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
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
      <TopBar
        right={
          <Pressable onPress={() => router.push(`/plants/edit?id=${id}`)} hitSlop={8} style={{ paddingHorizontal: 6, paddingVertical: 10 }} accessibilityRole="button" testID="plant-edit">
            <Txt size={13} weight="bold">
              {t('편집', 'EDIT', '編集')}
            </Txt>
          </Pressable>
        }
      />
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
      await qc.invalidateQueries({ queryKey: ['plants'] });
      router.back();
    } catch (e) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(e));
      setBusy(false);
    }
  };

  return (
    <View>
      <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 10 }}>
        {['PLANT', categoryPath(cats, p.category_id) || t('미분류', 'Unsorted', '未分類')].join(' / ')}
      </Txt>
      <PhotoPager uris={p.photo_paths.map((x) => resolve(x))} testID="plant-photos-view" />
      <Txt italic size={26} style={{ lineHeight: 32 }} testID="plant-title">
        {p.scientific_name}
      </Txt>
      {!!p.nickname && (
        <Txt size={14} color={C.sub} style={{ marginTop: 4 }}>
          {p.nickname}
        </Txt>
      )}
      <View style={{ marginTop: 18 }}>
        <InfoRow label={t('분류', 'Category', '分類')} value={categoryPath(cats, p.category_id) || t('미분류', 'Unsorted', '未分類')} testID="plant-info-category" />
        <InfoRow label={t('동정', 'ID', '同定')} value={idStatusLabel(p.identification_status, locale)} />
        <InfoRow label={t('원산지', 'Origin', '原産地')} value={originLabel(p.origin_region, p.origin_place, locale)} testID="plant-info-origin" />
        {parent(p.seed_parent_id, p.seed_parent_name, t('모본 (♀)', 'Seed (♀)', '母本 (♀)'), 'plant-info-seed')}
        {parent(p.pollen_parent_id, p.pollen_parent_name, t('부본 (♂)', 'Pollen (♂)', '父本 (♂)'), 'plant-info-pollen')}
      </View>
      {!!p.notes && (
        <Txt size={13} color="#333" style={{ marginTop: 18, lineHeight: 21 }}>
          {p.notes}
        </Txt>
      )}
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
        <ToggleRow label={t('나만 보기', 'Only me', '自分だけ')} value={p.is_private} onChange={togglePrivate} testID="plant-private-toggle" />
      </View>
      <Button kind="danger" label={t('삭제', 'Delete', '削除')} onPress={() => remove(p)} busy={busy} testID="plant-delete" />
    </View>
  );
}
