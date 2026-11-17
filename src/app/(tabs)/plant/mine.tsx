import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { usePrompt } from '@/components/prompt';
import { ActionChips, ItemRow, Nest, SubRow } from '@/components/rows';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { AllTotal, BigRow, Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addCategory, countInTop, deleteCategory, renameCategory, seedCategories, subCategories, topCategories, unsortedPlants, useCategories, usePlants } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
import { originLabel } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel } from '@/lib/labels';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Category, Plant } from '@/lib/types';

export default function MyPlants() {
  const { t } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onAdd={() => router.push('/plants/edit')} addLabel={t('식물 추가', 'Add plant', '植物を追加')} />
      <Page testID="mine-screen">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          <Categories />
        </MemberGate>
      </Page>
    </View>
  );
}

function Categories() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const prompt = usePrompt();
  const catsQ = useCategories();
  const plantsQ = usePlants();
  const cats = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);
  const [openTop, setOpenTop] = useState<Set<string>>(new Set());
  const [openSub, setOpenSub] = useState<Set<string>>(new Set());
  const [openUnsorted, setOpenUnsorted] = useState(false);

  useEffect(() => {
    if (user && catsQ.isSuccess && catsQ.data.length === 0) seedCategories(user.id, locale, qc).catch(() => {});
  }, [user, catsQ.isSuccess, catsQ.data, locale, qc]);

  const resolve = useSignedUrls(plants.map((p) => p.photo_paths[0]));
  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] }).then(() => qc.invalidateQueries({ queryKey: ['plants'] }));
  const failed = (e: unknown) => notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));

  const add = async (parent: Category | null) => {
    const name = await prompt({
      title: parent ? t(`‘${parent.name}’ 하위 분류`, `New sub-category in “${parent.name}”`, `「${parent.name}」の下位分類`) : t('새 분류', 'New category', '新しい分類'),
      placeholder: parent ? t('예: Bulbophyllum', 'e.g. Bulbophyllum', '例：Bulbophyllum') : t('예: Begonia', 'e.g. Begonia', '例：Begonia'),
    });
    if (!name || !user) return;
    try {
      await addCategory(user.id, name, parent?.id ?? null, parent ? subCategories(cats, parent.id) : topCategories(cats));
      if (parent) setOpenTop(new Set(openTop).add(parent.id));
      await refresh();
    } catch (e) {
      failed(e);
    }
  };
  const rename = async (c: Category) => {
    const name = await prompt({ title: t('분류 이름 바꾸기', 'Rename category', '分類名を変更'), initial: c.name });
    if (!name || name === c.name) return;
    try {
      await renameCategory(c.id, name);
      await refresh();
    } catch (e) {
      failed(e);
    }
  };
  const remove = async (c: Category) => {
    const subs = subCategories(cats, c.id);
    const ids = new Set([c.id, ...subs.map((s) => s.id)]);
    const n = plants.filter((p) => p.category_id && ids.has(p.category_id)).length;
    const msg = [
      subs.length ? t('하위 분류도 함께 삭제됩니다.', 'Its sub-categories are deleted too.', '下位分類も削除されます。') : '',
      n ? t(`들어 있던 식물 ${n}개는 ‘미분류’로 옮겨집니다.`, `Its ${n} plant(s) move to “Unsorted”.`, `植物${n}件は「未分類」に移動します。`) : '',
    ].filter(Boolean).join(' ');
    const ok = await confirmAsync(t(`‘${c.name}’ 분류를 삭제할까요?`, `Delete “${c.name}”?`, `「${c.name}」を削除しますか？`), msg, t('삭제', 'Delete', '削除'), t('취소', 'Cancel', 'キャンセル'), true);
    if (!ok) return;
    try {
      await deleteCategory(c.id);
      await refresh();
    } catch (e) {
      failed(e);
    }
  };

  if (catsQ.isLoading || plantsQ.isLoading) return <Loading />;
  if (catsQ.error || plantsQ.error) return <Notice tone="warning">{errorText(catsQ.error ?? plantsQ.error)}</Notice>;

  const row = (p: Plant) => (
    <ItemRow
      key={p.id}
      name={p.scientific_name}
      meta={[p.nickname, p.identification_status === 'verified' ? idStatusLabel('verified', locale) : '', originLabel(p.origin_region, p.origin_place, locale)].filter(Boolean).join(' · ')}
      badge={p.is_private ? t('나만 보기', 'PRIVATE', '非公開') : undefined}
      thumb={resolve(p.photo_paths[0])}
      onPress={() => router.push(`/plants/${p.id}`)}
      testID={`plant-row-${p.id}`}
    />
  );
  const unsorted = unsortedPlants(plants, cats);

  return (
    <View>
      {topCategories(cats).map((top) => {
        const n = countInTop(plants, cats, top.id);
        const open = openTop.has(top.id);
        const subs = subCategories(cats, top.id);
        return (
          <View key={top.id}>
            <BigRow title={top.name} count={n} empty={!n && !open} lined={false} onPress={() => toggle(openTop, top.id, setOpenTop)} testID={`cat-${top.name}`} />
            {open && (
              <Nest>
                {subs.map((sub) => {
                  const inSub = plants.filter((p) => p.category_id === sub.id);
                  const subOpen = openSub.has(sub.id);
                  return (
                    <View key={sub.id}>
                      <SubRow title={sub.name} count={inSub.length} empty={!inSub.length} open={subOpen} onPress={() => toggle(openSub, sub.id, setOpenSub)} testID={`sub-${sub.name}`} />
                      {subOpen && (
                        <Nest light>
                          {inSub.map(row)}
                          <ActionChips
                            actions={[
                              { label: t('+ 식물', '+ Plant', '+ 植物'), primary: true, onPress: () => router.push(`/plants/edit?categoryId=${sub.id}`), testID: `sub-add-plant-${sub.name}` },
                              { label: t('이름 변경', 'Rename', '名前変更'), onPress: () => rename(sub), testID: `sub-rename-${sub.name}` },
                              { label: t('삭제', 'Delete', '削除'), onPress: () => remove(sub), testID: `sub-delete-${sub.name}` },
                            ]}
                          />
                        </Nest>
                      )}
                    </View>
                  );
                })}
                {plants.filter((p) => p.category_id === top.id).map(row)}
                <ActionChips
                  actions={[
                    { label: t('+ 식물', '+ Plant', '+ 植物'), primary: true, onPress: () => router.push(`/plants/edit?categoryId=${top.id}`), testID: `cat-add-plant-${top.name}` },
                    { label: t('+ 하위 분류', '+ Sub-category', '+ 下位分類'), onPress: () => add(top), testID: `cat-add-sub-${top.name}` },
                    { label: t('이름 변경', 'Rename', '名前変更'), onPress: () => rename(top), testID: `cat-rename-${top.name}` },
                    { label: t('삭제', 'Delete', '削除'), onPress: () => remove(top), testID: `cat-delete-${top.name}` },
                  ]}
                />
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
      <Pressable onPress={() => add(null)} style={{ marginTop: 18, paddingVertical: 8 }} accessibilityRole="button" testID="cat-add">
        <Txt size={13} color={C.sub}>
          {t('+ 분류 추가', '+ Add category', '+ 分類を追加')}
        </Txt>
      </Pressable>
      <AllTotal n={plants.length} />
    </View>
  );
}
