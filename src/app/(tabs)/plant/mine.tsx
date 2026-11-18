import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { usePrompt } from '@/components/prompt';
import { ItemRow, Nest, PlusButton, TextAction } from '@/components/rows';
import { TopBar } from '@/components/top-bar';
import { AllTotal, BigRow, Loading, Notice, Page } from '@/components/ui';
import { renameGenusCategory, subCategories, topCategories, unsortedPlants, useCategories, usePlants } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { originLabel } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel } from '@/lib/labels';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Plant } from '@/lib/types';

const addPlant = (genus?: string) => router.push(genus ? `/plants/edit?genus=${encodeURIComponent(genus)}` : '/plants/edit');

export default function MyPlants() {
  const { t } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onAdd={() => addPlant()} addLabel={t('식물 추가', 'Add plant', '植物を追加')} />
      <Page testID="mine-screen">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          <GenusList />
        </MemberGate>
      </Page>
    </View>
  );
}

/** My Plants grouped by genus. Each genus category was created when a plant with that genus was saved. */
function GenusList() {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const prompt = usePrompt();
  const catsQ = useCategories();
  const plantsQ = usePlants();
  const cats = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [openUnsorted, setOpenUnsorted] = useState(false);
  const resolve = useSignedUrls(plants.map((p) => p.photo_paths[0]));

  if (catsQ.isLoading || plantsQ.isLoading) return <Loading />;
  if (catsQ.error || plantsQ.error) return <Notice tone="warning">{errorText(catsQ.error ?? plantsQ.error)}</Notice>;

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };
  const rename = async (catId: string, current: string) => {
    const name = await prompt({
      title: t('속 이름 바꾸기', 'Rename genus', '属名を変更'),
      message: t('이 속의 식물 이름도 함께 바뀝니다. 이미 있는 속 이름을 넣으면 두 속이 합쳐집니다.', 'Plant names in this genus change too. Using an existing genus merges the two.', 'この属の植物名も変わります。既存の属名にすると統合されます。'),
      initial: current,
    });
    const cat = cats.find((c) => c.id === catId);
    if (!name || !cat || name === current) return;
    try {
      await renameGenusCategory(cat, name, cats, plants);
      await Promise.all([qc.invalidateQueries({ queryKey: ['categories'] }), qc.invalidateQueries({ queryKey: ['plants'] })]);
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    }
  };
  const row = (p: Plant) => (
    <ItemRow
      key={p.id}
      name={p.scientific_name}
      meta={[p.nickname, p.identification_status === 'verified' ? idStatusLabel('verified', locale) : '', originLabel(p.origin_region, p.origin_place, locale)].filter(Boolean).join(' · ')}
      badge={p.is_private ? t('비공개', 'PRIVATE', '非公開') : undefined}
      thumb={resolve(p.photo_paths[0])}
      onPress={() => router.push(`/plants/${p.id}`)}
      testID={`plant-row-${p.id}`}
    />
  );
  const tops = topCategories(cats);
  const unsorted = unsortedPlants(plants, cats);

  if (!plants.length && !tops.length)
    return (
      <View testID="mine-empty" style={{ alignItems: 'center', paddingVertical: 40, gap: 18 }}>
        <Notice>{t('＋를 눌러 첫 식물을 등록해 보세요. 입력한 속(예: Bulbophyllum)이 그대로 분류가 됩니다.', 'Tap ＋ to add your first plant. The genus you type (e.g. Bulbophyllum) becomes its category.', '＋を押して最初の植物を登録しましょう。入力した属（例：Bulbophyllum）がそのまま分類になります。')}</Notice>
        <PlusButton onPress={() => addPlant()} label={t('식물 추가', 'Add plant', '植物を追加')} size={56} testID="mine-plus" />
      </View>
    );

  return (
    <View>
      {tops.map((top) => {
        const ids = new Set([top.id, ...subCategories(cats, top.id).map((s) => s.id)]);
        const inGenus = plants.filter((p) => p.category_id && ids.has(p.category_id));
        const isOpen = open.has(top.id);
        return (
          <View key={top.id}>
            <BigRow title={top.name} count={inGenus.length} empty={!inGenus.length && !isOpen} lined={false} onPress={() => toggle(top.id)} testID={`cat-${top.name}`} />
            {isOpen && (
              <Nest>
                {inGenus.map(row)}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 }}>
                  <PlusButton onPress={() => addPlant(top.name)} label={t(`${top.name} 식물 추가`, `Add a ${top.name}`, `${top.name}を追加`)} size={36} testID={`cat-plus-${top.name}`} />
                  <TextAction label={t('이름 변경', 'Rename', '名前変更')} onPress={() => rename(top.id, top.name)} testID={`cat-rename-${top.name}`} />
                </View>
              </Nest>
            )}
          </View>
        );
      })}
      {!!unsorted.length && (
        <View>
          <BigRow title={t('미분류', 'Unsorted', '未分類')} count={unsorted.length} lined={false} onPress={() => setOpenUnsorted(!openUnsorted)} testID="cat-unsorted" />
          {openUnsorted && <Nest>{unsorted.map(row)}</Nest>}
        </View>
      )}
      <View style={{ marginTop: 22, alignItems: 'flex-start' }}>
        <PlusButton onPress={() => addPlant()} label={t('식물 추가', 'Add plant', '植物を追加')} testID="mine-plus" />
      </View>
      <AllTotal n={plants.length} />
    </View>
  );
}
