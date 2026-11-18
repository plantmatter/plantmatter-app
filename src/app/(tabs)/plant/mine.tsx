import { useMemo } from 'react';
import { View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { TopBar } from '@/components/top-bar';
import { AllTotal, BigRow, Loading, Notice, Page } from '@/components/ui';
import { plantsInTop, topCategories, unsortedPlants, useCategories, usePlants } from '@/lib/data';
import { useLocale } from '@/lib/i18n';
import { addPlant, openCollection } from '@/lib/nav';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function MyPlants() {
  const { t } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onAdd={() => addPlant()} addLabel={t('식물 추가', 'Add plant', '植物を追加')} />
      <Page testID="mine-screen">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          <Collections />
        </MemberGate>
      </Page>
    </View>
  );
}

/**
 * "All" first, then one row per genus that holds plants (genus categories are made when a plant is saved).
 * Each row opens its own page; adding a plant is the ＋ at the top right.
 */
function Collections() {
  const { t } = useLocale();
  const catsQ = useCategories();
  const plantsQ = usePlants();
  const cats = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);

  if (catsQ.isLoading || plantsQ.isLoading) return <Loading />;
  if (catsQ.error || plantsQ.error) return <Notice tone="warning">{errorText(catsQ.error ?? plantsQ.error)}</Notice>;

  const genera = topCategories(cats)
    .map((c) => ({ cat: c, n: plantsInTop(plants, cats, c.id).length }))
    .filter((g) => g.n > 0)
    .sort((a, b) => a.cat.name.localeCompare(b.cat.name));
  const unsorted = unsortedPlants(plants, cats);

  return (
    <View>
      <BigRow title="All" count={plants.length} empty={!plants.length} onPress={() => openCollection('all')} testID="cat-all" />
      {genera.map(({ cat, n }) => (
        <BigRow key={cat.id} title={cat.name} count={n} onPress={() => openCollection(cat.id)} testID={`cat-${cat.name}`} />
      ))}
      {!!unsorted.length && <BigRow title={t('미분류', 'Unsorted', '未分類')} count={unsorted.length} onPress={() => openCollection('unsorted')} testID="cat-unsorted" />}
      <AllTotal n={plants.length} />
    </View>
  );
}
