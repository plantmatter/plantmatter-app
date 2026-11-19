import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { deleteCategory, moveCategory, renameCategory, reorderCategories } from '@/lib/data';
import { chooseAsync, confirmAsync } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { openCollection } from '@/lib/nav';
import { C } from '@/lib/theme';
import { canMoveUnder, childrenOf, depthOf, MAX_DEPTH, pathLabel, plantsDirectlyIn, plantsUnder } from '@/lib/tree';
import type { Category, Plant } from '@/lib/types';
import { useCategoryEdit } from '@/lib/use-categories-edit';

import { CategoryPicker, levelName } from './category-picker';
import { MoreIcon, Plus } from './icons';
import { usePrompt } from './prompt';
import { ReorderList } from './reorder-list';
import { SubRow } from './rows';
import { Txt } from './txt';
import { BigRow } from './ui';

const EDIT_ROW = 64;

/**
 * The categories right under `parentId` (null = 대분류 on the My Plants page). Counts include everything below;
 * empty ones are pale. While `editing`, rows are dragged by ≡ to reorder, ⋯ (or a tap) renames / moves / deletes,
 * and "＋ 새 …" adds one at this level.
 */
export function CategoryRows({ parentId, cats, plants, editing, big = false, testID = 'cat' }: { parentId: string | null; cats: Category[]; plants: Plant[]; editing: boolean; big?: boolean; testID?: string }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const prompt = usePrompt();
  const edit = useCategoryEdit();
  const [moving, setMoving] = useState<Category | null>(null);
  const kids = childrenOf(cats, parentId);
  const level = parentId ? depthOf(cats, parentId) + 1 : 1;
  const levelLabel = levelName(level, t);
  const fail = t('저장하지 못했습니다', 'Could not save', '保存できませんでした');

  const add = async () => {
    if (!user) return;
    const name = await prompt({
      title: t(`새 ${levelLabel}`, `New ${levelLabel}`, `新しい${levelLabel}`),
      message: parentId ? t(`"${pathLabel(cats, parentId)}" 안에 만듭니다.`, `Inside "${pathLabel(cats, parentId)}".`, `「${pathLabel(cats, parentId)}」の中に作ります。`) : undefined,
      placeholder: level === 1 ? 'Orchid' : level === 2 ? 'Bulbophyllum' : t('유묘', 'Seedlings', '実生'),
      maxLength: 40,
    });
    if (name) await edit.create(name, parentId);
  };
  const rename = async (cat: Category) => {
    const name = await prompt({ title: t('이름 변경', 'Rename', '名前変更'), initial: cat.name, maxLength: 40 });
    if (name && name !== cat.name) await edit.run(() => renameCategory(cat, name, cats, t), fail);
  };
  const remove = async (cat: Category) => {
    const where = cat.parent_id ? `"${pathLabel(cats, cat.parent_id)}"` : t('미분류', 'Unsorted', '未分類');
    const hasKids = childrenOf(cats, cat.id).length > 0;
    const ok = await confirmAsync(
      t(`"${cat.name}"을(를) 삭제할까요?`, `Delete "${cat.name}"?`, `「${cat.name}」を削除しますか？`),
      [
        plantsDirectlyIn(plants, cat.id).length ? t(`식물은 지워지지 않고 ${where}(으)로 옮겨집니다.`, `No plant is deleted: they move to ${where}.`, `植物は削除されず${where}へ移ります。`) : '',
        hasKids ? t('안에 있는 분류는 한 단계 위로 올라갑니다.', 'Categories inside move up one level.', '中の分類は一つ上の段階に移ります。') : '',
      ]
        .filter(Boolean)
        .join(' '),
      t('삭제', 'Delete', '削除'),
      t('취소', 'Cancel', 'キャンセル'),
      true,
    );
    if (ok) await edit.run(() => deleteCategory(cat, cats, plants), t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'));
  };
  const actions = async (cat: Category) => {
    const i = await chooseAsync([t('이름 변경', 'Rename', '名前変更'), t('다른 분류로 옮기기', 'Move to another category', '別の分類へ移動'), t('삭제', 'Delete', '削除')], t('취소', 'Cancel', 'キャンセル'), cat.name);
    if (i === 0) rename(cat);
    else if (i === 1) setMoving(cat);
    else if (i === 2) remove(cat);
  };
  const move = async (to: string | null) => {
    const cat = moving;
    setMoving(null);
    if (cat && to !== (cat.parent_id ?? null)) await edit.run(() => moveCategory(cat, to, cats, t), fail);
  };

  if (!editing)
    return (
      <View testID={`${testID}-rows`}>
        {kids.map((c) => {
          const n = plantsUnder(plants, cats, c.id).length;
          return big ? (
            <BigRow key={c.id} title={c.name} count={n} empty={!n} onPress={() => openCollection(c.id)} testID={`${testID}-${c.name}`} />
          ) : (
            <SubRow key={c.id} title={c.name} count={n} empty={!n} onPress={() => openCollection(c.id)} testID={`${testID}-${c.name}`} />
          );
        })}
      </View>
    );

  return (
    <View testID={`${testID}-edit`}>
      <ReorderList
        items={kids}
        keyOf={(c) => c.id}
        rowHeight={EDIT_ROW}
        onReorder={(next) => edit.run(() => reorderCategories(next.map((c) => c.id)), fail)}
        testID={`${testID}-order`}
        renderRow={(c, handle) => {
          const n = plantsUnder(plants, cats, c.id).length;
          return (
            <View style={styles.editRow}>
              {handle}
              <Pressable onPress={() => actions(c)} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }} accessibilityRole="button" testID={`${testID}-edit-${c.name}`}>
                <Txt weight="bold" size={big ? 24 : 19} color={n ? C.ink : C.faint} numberOfLines={1} style={{ flexShrink: 1, letterSpacing: big ? -0.5 : 0 }}>
                  {c.name}
                </Txt>
                <Txt size={11} color={C.muted} style={{ marginLeft: 6, marginBottom: big ? 4 : 2 }}>
                  ({n})
                </Txt>
              </Pressable>
              <Pressable onPress={() => actions(c)} hitSlop={6} style={styles.more} accessibilityRole="button" accessibilityLabel={t(`${c.name} 편집`, `Edit ${c.name}`, `${c.name}を編集`)} testID={`${testID}-more-${c.name}`}>
                <MoreIcon size={22} />
              </Pressable>
            </View>
          );
        }}
      />
      {level <= MAX_DEPTH && (
        <Pressable onPress={add} style={styles.add} accessibilityRole="button" testID={`${testID}-add`}>
          <Plus size={18} />
          <Txt size={14} weight="bold" style={{ marginLeft: 8 }}>
            {t(`새 ${levelLabel} 만들기`, `New ${levelLabel}`, `新しい${levelLabel}`)}
          </Txt>
        </Pressable>
      )}
      <CategoryPicker
        visible={!!moving}
        title={moving ? t(`"${moving.name}" 옮길 곳`, `Move "${moving.name}" to`, `「${moving.name}」の移動先`) : ''}
        cats={cats}
        value={moving?.parent_id ?? null}
        noneLabel={t('맨 위 (대분류로)', 'Top level (as a category)', 'いちばん上（大分類として）')}
        blocked={(id) => !moving || !canMoveUnder(cats, moving.id, id)}
        onPick={move}
        onClose={() => setMoving(null)}
        testID="move-category-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  editRow: { height: EDIT_ROW, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.hair, backgroundColor: C.bg },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingLeft: 10 },
});
