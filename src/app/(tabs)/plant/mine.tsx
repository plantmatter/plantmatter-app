import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CategoryRows } from '@/components/category-rows';
import { MemberGate } from '@/components/gate';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { AllTotal, BigRow, Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { unsortedPlants, useCategories, usePlants } from '@/lib/data';
import { useLocale } from '@/lib/i18n';
import { addPlant, openCollection } from '@/lib/nav';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function MyPlants() {
  const { t } = useLocale();
  const { member } = useAuth();
  const [editing, setEditing] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar
        onAdd={editing ? undefined : () => addPlant()}
        addLabel={t('식물 추가', 'Add plant', '植物を追加')}
        onEdit={member ? () => setEditing(!editing) : undefined}
        editLabel={editing ? 'DONE' : undefined}
        editTestID="mine-edit"
      />
      <Page testID="mine-screen">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          <Collections editing={editing} />
        </MemberGate>
      </Page>
    </View>
  );
}

/**
 * "All" first, then the user's 대분류 (counts include everything below), then 미분류.
 * EDIT manages the 대분류: add, rename, reorder by dragging, move under another, delete.
 */
function Collections({ editing }: { editing: boolean }) {
  const { t } = useLocale();
  const catsQ = useCategories();
  const plantsQ = usePlants();
  const cats = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);

  if (catsQ.isLoading || plantsQ.isLoading) return <Loading />;
  if (catsQ.error || plantsQ.error) return <Notice tone="warning">{errorText(catsQ.error ?? plantsQ.error)}</Notice>;

  const unsorted = unsortedPlants(plants, cats);
  if (editing)
    return (
      <View>
        <Txt size={12} color={C.sub} style={{ lineHeight: 18, marginBottom: 10 }} testID="mine-edit-hint">
          {t('≡를 끌어 순서를 바꾸고, ⋯를 눌러 이름 변경 · 이동 · 삭제를 합니다. 분류를 지워도 식물은 지워지지 않습니다.', 'Drag ≡ to reorder; tap ⋯ to rename, move or delete. Deleting a category never deletes plants.', '≡をドラッグして並べ替え、⋯で名前変更・移動・削除。分類を削除しても植物は消えません。')}
        </Txt>
        <CategoryRows parentId={null} cats={cats} plants={plants} editing big />
      </View>
    );
  return (
    <View>
      <BigRow title="All" count={plants.length} empty={!plants.length} onPress={() => openCollection('all')} testID="cat-all" />
      <CategoryRows parentId={null} cats={cats} plants={plants} editing={false} big />
      {!!unsorted.length && <BigRow title={t('미분류', 'Unsorted', '未分類')} count={unsorted.length} onPress={() => openCollection('unsorted')} testID="cat-unsorted" />}
      <AllTotal n={plants.length} />
    </View>
  );
}
