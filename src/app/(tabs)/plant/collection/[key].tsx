import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/category-picker';
import { CategoryRows } from '@/components/category-rows';
import { EditGuard } from '@/components/edit-guard';
import { MemberGate } from '@/components/gate';
import { CheckMark, Plus, SearchIcon, SortIcon } from '@/components/icons';
import { usePrompt } from '@/components/prompt';
import { ReorderList } from '@/components/reorder-list';
import { ItemRow, TextAction } from '@/components/rows';
import { SearchPanel } from '@/components/search-panel';
import { TopBar } from '@/components/top-bar';
import { baselineFromBottom, boldTextWidth, Txt } from '@/components/txt';
import { Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deletePlants, movePlants, renameCategory, reorderPlants, setPlantsPrivate, useCategories, usePlants } from '@/lib/data';
import { chooseAsync, confirmAsync } from '@/lib/dialogs';
import { originLabel } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel, noCategoryLabel } from '@/lib/labels';
import { addPlant } from '@/lib/nav';
import { useSignedUrls } from '@/lib/photos';
import { matchesPlant } from '@/lib/search';
import { errorText } from '@/lib/supabase';
import { BAR_HEIGHT, C, GUTTER } from '@/lib/theme';
import { childrenOf, depthOf, MAX_DEPTH, PLANT_SORTS, plantsDirectlyIn, plantsUnder, sortPlants, unsortedPlants, type PlantSort } from '@/lib/tree';
import type { Plant } from '@/lib/types';
import { useCategoryEdit } from '@/lib/use-categories-edit';
import { dueTag, useWateringPlans } from '@/lib/use-watering';

const SORT_KEY = 'pm-plant-sort';
const PLANT_ROW = 80;
/** Title sizes, largest first: a long name steps down until it fits on one line with its count and the tools. */
const TITLE_SIZES = [40, 36, 32, 28];
// Search · sort · ＋ next to the title: 20 px icons whose lines still look 1.5 px like every other icon,
// 36 apart, each still easy to press (44 × 44 with the slop).
const TOOL_ICON = 20;
const TOOL_STROKE = (1.5 * 24) / TOOL_ICON;
const TOOL_SLOP = { left: 4, right: 4, top: 0, bottom: 4 };
/** Empty space under the drawing inside a tool icon whose lowest point is at `bottom` on the 24 grid. */
const toolGap = (bottom: number) => ((24 - bottom - TOOL_STROKE / 2) * TOOL_ICON) / 24;

/** The list order chosen with ↓↑, remembered on this phone for every My Plants page. */
function useSortChoice() {
  const [sort, setSort] = useState<PlantSort>('newest');
  useEffect(() => {
    AsyncStorage.getItem(SORT_KEY)
      .then((v) => v && (PLANT_SORTS as string[]).includes(v) && setSort(v as PlantSort))
      .catch(() => {});
  }, []);
  const choose = (v: PlantSort) => {
    setSort(v);
    AsyncStorage.setItem(SORT_KEY, v).catch(() => {});
  };
  return [sort, choose] as const;
}

/** One My Plants page: All, 미분류 or one category (its sub-categories, then the plants directly in it). */
export default function CollectionScreen() {
  const { t, locale } = useLocale();
  const { member } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { key } = useLocalSearchParams<{ key: string }>();
  const id = String(key ?? 'all');
  const prompt = usePrompt();
  const edit = useCategoryEdit();
  const catsQ = useCategories();
  const plantsQ = usePlants();
  const cats = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const plants = useMemo(() => plantsQ.data ?? [], [plantsQ.data]);
  const [sort, setSort] = useSortChoice();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [movingPlants, setMovingPlants] = useState(false);

  const cat = cats.find((c) => c.id === id) ?? null;
  // Everything this page holds (for the count and the search), and what is listed directly on it.
  const all = id === 'all' ? plants : id === 'unsorted' ? unsortedPlants(plants, cats) : cat ? plantsUnder(plants, cats, cat.id) : [];
  const direct = cat ? plantsDirectlyIn(plants, cat.id) : all;
  const q = query.trim();
  const plans = useWateringPlans();
  const listed = sortPlants(q ? all.filter((p) => matchesPlant(p, q)) : direct, sort, (p) => plans.planOf(p).dueIn);
  const kids = cat ? childrenOf(cats, cat.id) : [];
  const chosen = plants.filter((p) => selected.includes(p.id));
  const title = id === 'all' ? 'All' : id === 'unsorted' ? noCategoryLabel(t) : (cat?.name ?? '');
  // A long name gets a smaller title so it stays on one line next to its count and the tools.
  const countWidth = 7 + boldTextWidth(`(${all.length})`, 12);
  const room = screenWidth - GUTTER * 2 - (3 * 36 - 8) - countWidth - 4;
  const titleSize = TITLE_SIZES.find((size) => boldTextWidth(title, size, -size / 40) <= room) ?? TITLE_SIZES[TITLE_SIZES.length - 1];
  const titleLine = Math.round(titleSize * 1.2);
  // The count and the icons sit on the title's baseline.
  const baseline = baselineFromBottom(title, titleSize, titleLine);

  const toggleEdit = () => {
    setSearching(false);
    setQuery('');
    setSelected([]);
    setEditing(!editing);
  };
  const toggle = (pid: string) => setSelected(selected.includes(pid) ? selected.filter((x) => x !== pid) : [...selected, pid]);
  const sortLabel = (s: PlantSort) =>
    ({
      newest: t('최근 등록순', 'Newest first', '登録が新しい順'),
      oldest: t('오래된 등록순', 'Oldest first', '登録が古い順'),
      name: t('이름순', 'By name', '名前順'),
      watering: t('물 준 지 오래된 순', 'Longest since watering', '水やりから長い順'),
      due: t('물 줄 날짜순', 'Next watering first', '水やり予定が近い順'),
      manual: t('직접 정한 순서', 'My own order', '自分で決めた順'),
    })[s];
  const pickSort = async () => {
    const i = await chooseAsync(
      PLANT_SORTS.map((s) => (s === sort ? `✓ ${sortLabel(s)}` : sortLabel(s))),
      t('취소', 'Cancel', 'キャンセル'),
      t('정렬', 'Sort', '並べ替え'),
    );
    if (i >= 0) setSort(PLANT_SORTS[i]);
  };
  const rename = async () => {
    if (!cat) return;
    const name = await prompt({ title: t('이름 변경', 'Rename', '名前変更'), initial: cat.name, maxLength: 40 });
    if (name && name !== cat.name) await edit.run(() => renameCategory(cat, name, cats, t));
  };
  const reorder = async (next: Plant[]) => {
    setSort('manual');
    await edit.run(() => reorderPlants(next.map((p) => p.id)));
  };
  const setVisibility = async () => {
    const i = await chooseAsync([t('공개로 바꾸기', 'Make public', '公開にする'), t('비공개로 바꾸기', 'Make private', '非公開にする')], t('취소', 'Cancel', 'キャンセル'), t(`${chosen.length}개 선택됨`, `${chosen.length} selected`, `${chosen.length}件選択`));
    if (i < 0) return;
    if (await edit.run(() => setPlantsPrivate(selected, i === 1))) setSelected([]);
  };
  const move = async (to: string | null) => {
    setMovingPlants(false);
    if (await edit.run(() => movePlants(selected, to))) setSelected([]);
  };
  const remove = async () => {
    const ok = await confirmAsync(
      t(`식물 ${chosen.length}개를 삭제할까요?`, `Delete ${chosen.length} plant(s)?`, `植物${chosen.length}件を削除しますか？`),
      t('사진과 기록이 함께 지워지며 되돌릴 수 없습니다.', 'Their photos and records are deleted for good.', '写真と記録も削除され、元に戻せません。'),
      t('삭제', 'Delete', '削除'),
      t('취소', 'Cancel', 'キャンセル'),
      true,
    );
    if (ok && (await edit.run(() => deletePlants(chosen), t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした')))) setSelected([]);
  };

  const ready = !catsQ.isLoading && !plantsQ.isLoading;
  const missing = ready && id !== 'all' && id !== 'unsorted' && !cat;
  const canEdit = member === true && ready && !missing;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <EditGuard editing={editing} onDone={toggleEdit} />
      <TopBar left={editing ? 'none' : 'back'} onEdit={canEdit ? toggleEdit : undefined} editLabel={editing ? 'DONE' : undefined} editTestID="collection-edit" />
      <Page testID="collection-screen">
        <MemberGate what={t('내 식물', 'My Plants', 'マイ植物')}>
          {!ready ? (
            <Loading />
          ) : catsQ.error || plantsQ.error ? (
            <Notice tone="warning">{errorText(catsQ.error ?? plantsQ.error)}</Notice>
          ) : missing ? (
            <Notice>{t('이 카테고리는 더 이상 없습니다.', 'This category no longer exists.', 'このカテゴリはもうありません。')}</Notice>
          ) : (
            <View>
              <View style={styles.titleRow} testID="collection-title">
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <Txt weight="bold" size={titleSize} style={{ letterSpacing: -titleSize / 40, lineHeight: titleLine, flexShrink: 1 }} testID="collection-name">
                    {title}
                  </Txt>
                  <Txt size={12} color={C.muted} style={{ marginLeft: 7, marginBottom: baseline - baselineFromBottom('(0)', 12) }} testID="collection-count">
                    ({all.length})
                  </Txt>
                </View>
                {!editing && (
                  <View style={styles.tools}>
                    <Pressable onPress={() => setSearching(true)} hitSlop={TOOL_SLOP} style={[styles.tool, { paddingBottom: baseline - toolGap(20.5) }]} accessibilityRole="button" accessibilityLabel={t('검색', 'Search', '検索')} testID="collection-search">
                      <SearchIcon size={TOOL_ICON} weight={TOOL_STROKE} />
                    </Pressable>
                    <Pressable onPress={pickSort} hitSlop={TOOL_SLOP} style={[styles.tool, { paddingBottom: baseline - toolGap(19.5) }]} accessibilityRole="button" accessibilityLabel={`${t('정렬', 'Sort', '並べ替え')}: ${sortLabel(sort)}`} testID="collection-sort">
                      <SortIcon size={TOOL_ICON} weight={TOOL_STROKE} />
                    </Pressable>
                    <Pressable onPress={() => addPlant(cat?.id)} hitSlop={TOOL_SLOP} style={[styles.tool, { paddingBottom: baseline - toolGap(19.5) }]} accessibilityRole="button" accessibilityLabel={cat ? t(`${cat.name}에 식물 추가`, `Add a plant to ${cat.name}`, `${cat.name}に植物を追加`) : t('식물 추가', 'Add plant', '植物を追加')} testID="collection-add">
                      <Plus size={TOOL_ICON} weight={TOOL_STROKE} />
                    </Pressable>
                  </View>
                )}
              </View>
              {editing && cat && (
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <TextAction label={t('이름 변경', 'Rename', '名前変更')} onPress={rename} testID="collection-rename" />
                </View>
              )}
              {!editing && !!q && (
                <Txt size={11} color={C.muted} style={{ marginTop: 6 }} testID="collection-searching">
                  {t(`"${q}" 검색 결과 ${listed.length}개`, `${listed.length} result(s) for "${q}"`, `「${q}」の検索結果 ${listed.length}件`)}
                </Txt>
              )}

              {/* sub-categories (hidden while a search shows every plant below as one list) */}
              {cat && !q && depthOf(cats, cat.id) < MAX_DEPTH && (editing || kids.length > 0) && (
                <View style={{ marginTop: 18 }}>
                  <CategoryRows parentId={cat.id} cats={cats} plants={plants} editing={editing} testID="sub" />
                </View>
              )}

              <View style={{ marginTop: 18 }}>
                {!all.length && !kids.length && (
                  <Notice>{t('아직 등록한 식물이 없습니다. 제목 옆 ＋를 눌러 식물을 등록해 보세요.', 'No plants yet. Tap ＋ next to the title to add one.', 'まだ植物がありません。タイトル横の＋から登録しましょう。')}</Notice>
                )}
                {!!q && !listed.length && (
                  <Txt size={13} color={C.muted} style={{ paddingVertical: 18 }} testID="collection-no-match">
                    {t('찾는 식물이 없습니다.', 'No plant matches.', '該当する植物がありません。')}
                  </Txt>
                )}
                {editing && listed.length > 0 && (
                  <View style={styles.selectAll}>
                    <Txt size={12} color={C.sub} style={{ flex: 1 }} testID="collection-selected">
                      {t(`${selected.length}개 선택됨`, `${selected.length} selected`, `${selected.length}件選択`)}
                    </Txt>
                    <TextAction
                      label={selected.length === listed.length ? t('선택 해제', 'Clear', '選択解除') : t('전체 선택', 'Select all', 'すべて選択')}
                      onPress={() => setSelected(selected.length === listed.length ? [] : listed.map((p) => p.id))}
                      testID="collection-select-all"
                    />
                  </View>
                )}
                {listed.length > 0 && <View style={{ borderTopWidth: 1, borderTopColor: C.hair }} />}
                {editing ? (
                  <EditPlantList plants={listed} selected={selected} onToggle={toggle} onReorder={reorder} />
                ) : (
                  <PlantList plants={listed} locale={locale} t={t} tagOf={(p) => dueTag(plans.planOf(p), t)} />
                )}
                {editing && <View style={{ height: 90 }} />}
              </View>
            </View>
          )}
        </MemberGate>
      </Page>

      {editing && (
        <View style={styles.editBar} testID="collection-edit-bar">
          <BarButton label={t('카테고리 이동', 'Move', 'カテゴリを移動')} disabled={!selected.length} onPress={() => setMovingPlants(true)} testID="bulk-move" />
          <BarButton label={t('공개 설정', 'Visibility', '公開設定')} disabled={!selected.length} onPress={setVisibility} testID="bulk-visibility" />
          <BarButton label={t(`삭제 (${selected.length})`, `Delete (${selected.length})`, `削除 (${selected.length})`)} disabled={!selected.length} danger onPress={remove} testID="bulk-delete" />
        </View>
      )}
      <View style={[styles.searchLayer, { top: BAR_HEIGHT + insets.top }]} pointerEvents="box-none">
        <SearchPanel
          open={searching}
          value={query}
          onChange={setQuery}
          onClose={() => {
            setSearching(false);
            setQuery('');
          }}
          placeholder={t('학명, 식물 이름, 나라로 검색', 'Search by scientific name, plant name or country', '学名・植物名・国で検索')}
          testID="plant-search"
        />
      </View>
      <CategoryPicker
        visible={movingPlants}
        title={t(`${selected.length}개를 옮길 카테고리`, `Move ${selected.length} to`, `${selected.length}件の移動先`)}
        cats={cats}
        value={cat?.id ?? null}
        noneLabel={noCategoryLabel(t)}
        onPick={move}
        onCreate={edit.create}
        onClose={() => setMovingPlants(false)}
        testID="move-plants-sheet"
      />
    </View>
  );
}

function PlantList({ plants, locale, t, tagOf }: { plants: Plant[]; locale: ReturnType<typeof useLocale>['locale']; t: ReturnType<typeof useLocale>['t']; tagOf: (p: Plant) => { label: string; strong: boolean } | null }) {
  const resolve = useSignedUrls(plants.map((p) => p.photo_paths[0]));
  return (
    <View>
      {plants.map((p) => (
        <ItemRow
          strong
          key={p.id}
          name={p.scientific_name}
          meta={[p.nickname, p.identification_status === 'verified' ? idStatusLabel('verified', locale) : '', originLabel(p.origin_region, p.origin_place, locale)].filter(Boolean).join(' · ')}
          badge={p.is_private ? t('비공개', 'PRIVATE', '非公開') : undefined}
          thumb={resolve(p.photo_paths[0])}
          tag={tagOf(p)}
          onPress={() => router.push(`/plants/${p.id}`)}
          testID={`plant-row-${p.id}`}
        />
      ))}
    </View>
  );
}

/** EDIT: tap a row to select it, drag ≡ to put it somewhere else (the list then keeps "my own order"). */
function EditPlantList({ plants, selected, onToggle, onReorder }: { plants: Plant[]; selected: string[]; onToggle: (id: string) => void; onReorder: (next: Plant[]) => void }) {
  const { t } = useLocale();
  const resolve = useSignedUrls(plants.map((p) => p.photo_paths[0]));
  return (
    <ReorderList
      items={plants}
      keyOf={(p) => p.id}
      rowHeight={PLANT_ROW}
      onReorder={onReorder}
      testID="plant-order"
      renderRow={(p, handle) => {
        const on = selected.includes(p.id);
        const thumb = resolve(p.photo_paths[0]);
        return (
          <View style={styles.plantRow}>
            <Pressable onPress={() => onToggle(p.id)} style={styles.plantPick} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`pick-${p.id}`}>
              <CheckMark on={on} />
              <View style={[styles.thumb, { pointerEvents: 'none' }]}>{thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt size={18} color="#BBB">✿</Txt>}</View>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={15} numberOfLines={2} style={{ lineHeight: 20 }}>
                  {p.scientific_name}
                </Txt>
                {(!!p.nickname || p.is_private) && (
                  <Txt size={11} color={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                    {[p.is_private ? t('비공개', 'PRIVATE', '非公開') : '', p.nickname].filter(Boolean).join(' · ')}
                  </Txt>
                )}
              </View>
            </Pressable>
            {handle}
          </View>
        );
      }}
    />
  );
}

function BarButton({ label, onPress, disabled, danger, testID }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.barButton, disabled && { opacity: 0.3 }]} accessibilityRole="button" accessibilityState={{ disabled }} testID={testID}>
      <Txt size={14} weight="bold" color={danger ? C.danger : C.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  tools: { flexDirection: 'row', alignItems: 'flex-end', marginRight: -8 },
  tool: { width: 36, height: 44, alignItems: 'center', justifyContent: 'flex-end' },
  selectAll: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
  plantRow: { height: PLANT_ROW, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.hair, backgroundColor: C.bg },
  plantPick: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, backgroundColor: '#E9E9E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  editBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line },
  barButton: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  searchLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
