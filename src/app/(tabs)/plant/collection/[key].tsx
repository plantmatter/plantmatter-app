import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { usePrompt } from '@/components/prompt';
import { ItemRow, TextAction } from '@/components/rows';
import { SearchField } from '@/components/search-field';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Loading, Notice, Page } from '@/components/ui';
import { plantsInTop, renameGenusCategory, unsortedPlants, useCategories, usePlants } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { originLabel } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel } from '@/lib/labels';
import { useSignedUrls } from '@/lib/photos';
import { addPlant } from '@/lib/nav';
import { matchesPlant, newestFirst } from '@/lib/search';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

/** One My Plants collection on its own page: All, Unsorted or one genus. */
export default function CollectionScreen() {
  const { t } = useLocale();
  const { key } = useLocalSearchParams<{ key: string }>();
  const cats = useCategories().data ?? [];
  const genus = cats.find((c) => c.id === key && !c.parent_id)?.name;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onAdd={() => addPlant(genus)} addLabel={genus ? t(`${genus} 식물 추가`, `Add a ${genus}`, `${genus}を追加`) : t('식물 추가', 'Add plant', '植物を追加')} />
      <Page testID="collection-screen">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          <Collection key={key} id={String(key ?? 'all')} />
        </MemberGate>
      </Page>
    </View>
  );
}

function Collection({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const prompt = usePrompt();
  const catsQ = useCategories();
  const plantsQ = usePlants();
  const cats = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);
  const [query, setQuery] = useState('');
  const cat = cats.find((c) => c.id === id && !c.parent_id);
  const inHere = useMemo(() => newestFirst(id === 'all' ? plants : id === 'unsorted' ? unsortedPlants(plants, cats) : cat ? plantsInTop(plants, cats, cat.id) : []), [id, plants, cats, cat]);
  const shown = useMemo(() => inHere.filter((p) => matchesPlant(p, query)), [inHere, query]);
  const resolve = useSignedUrls(shown.map((p) => p.photo_paths[0]));

  if (catsQ.isLoading || plantsQ.isLoading) return <Loading />;
  if (catsQ.error || plantsQ.error) return <Notice tone="warning">{errorText(catsQ.error ?? plantsQ.error)}</Notice>;
  if (id !== 'all' && id !== 'unsorted' && !cat)
    return <Notice>{t('이 분류는 더 이상 없습니다. 식물이 모두 다른 속으로 옮겨졌을 수 있습니다.', 'This category no longer exists. Its plants may have moved to another genus.', 'この分類はもうありません。植物が別の属へ移動した可能性があります。')}</Notice>;

  const title = id === 'all' ? 'All' : id === 'unsorted' ? t('미분류', 'Unsorted', '未分類') : cat!.name;
  const rename = async () => {
    if (!cat) return;
    const name = await prompt({
      title: t('속 이름 바꾸기', 'Rename genus', '属名を変更'),
      message: t('이 속의 식물 이름도 함께 바뀝니다. 이미 있는 속 이름을 넣으면 두 속이 합쳐집니다.', 'Plant names in this genus change too. Using an existing genus merges the two.', 'この属の植物名も変わります。既存の属名にすると統合されます。'),
      initial: cat.name,
    });
    if (!name || name === cat.name) return;
    try {
      const target = await renameGenusCategory(cat, name, cats, plants);
      await Promise.all([qc.invalidateQueries({ queryKey: ['categories'] }), qc.invalidateQueries({ queryKey: ['plants'] })]);
      if (target !== cat.id) router.setParams({ key: target });
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 4 }} testID="collection-title">
        <Txt weight="bold" size={36} style={{ letterSpacing: -0.9, lineHeight: 44, flexShrink: 1 }}>
          {title}
        </Txt>
        <Txt size={12} color={C.muted} style={{ marginLeft: 6, marginTop: 5 }} testID="collection-count">
          ({inHere.length})
        </Txt>
      </View>
      {cat && (
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <TextAction label={t('이름 변경', 'Rename', '名前変更')} onPress={rename} testID="collection-rename" />
        </View>
      )}
      <View style={{ marginTop: 22 }}>
        {inHere.length > 0 && <SearchField value={query} onChange={setQuery} placeholder={t('식물 이름, 학명으로 검색', 'Search by plant name or scientific name', '植物名・学名で検索')} testID="collection-search" />}
        {!inHere.length && (
          <Notice>{t('아직 등록한 식물이 없습니다. 오른쪽 위 ＋를 눌러 식물을 등록해 보세요.', 'No plants yet. Tap ＋ at the top right to add one.', 'まだ植物がありません。右上の＋から登録しましょう。')}</Notice>
        )}
        {inHere.length > 0 && !shown.length && (
          <Txt size={13} color={C.muted} style={{ paddingVertical: 18 }} testID="collection-no-match">
            {t('찾는 식물이 없습니다.', 'No plant matches.', '該当する植物がありません。')}
          </Txt>
        )}
        {shown.map((p) => (
          <ItemRow
            key={p.id}
            name={p.scientific_name}
            meta={[p.nickname, p.identification_status === 'verified' ? idStatusLabel('verified', locale) : '', originLabel(p.origin_region, p.origin_place, locale)].filter(Boolean).join(' · ')}
            badge={p.is_private ? t('비공개', 'PRIVATE', '非公開') : undefined}
            thumb={resolve(p.photo_paths[0])}
            onPress={() => router.push(`/plants/${p.id}`)}
            testID={`plant-row-${p.id}`}
          />
        ))}
      </View>
    </View>
  );
}
