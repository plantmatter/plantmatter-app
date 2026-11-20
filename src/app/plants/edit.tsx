import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CategoryPicker } from '@/components/category-picker';
import { FamilyField } from '@/components/family-field';
import { Plus } from '@/components/icons';
import { MemberGate } from '@/components/gate';
import { PhotoField } from '@/components/photos';
import { PlacePicker, type PlaceValue } from '@/components/place-picker';
import { NamePreview } from '@/components/sci-name';
import { usePrompt } from '@/components/prompt';
import { Sheet, SheetItem } from '@/components/sheet';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, ChoiceChips, Field, Label, Loading, Page, ScreenTitle, SectionHead, Segmented, SelectBox, VisibilityField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { childrenOf, pathLabel, savePlant, useCategories, useFinds, usePlants, useShops, type PlantInput } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { ID_STATUSES, idStatusLabel, noCategoryLabel } from '@/lib/labels';
import { cleanCultivar, composeName, familyForGenus, knownFamilies, knownGenera, normalizeFamily, normalizeGenus, parseName, splitQualifier, type Qualifier } from '@/lib/names';
import { storeFormPhotos, useSignedUrls, userFolder, type FormPhoto } from '@/lib/photos';
import { errorText, USER_BUCKET } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { useCategoryEdit } from '@/lib/use-categories-edit';
import { cleanInterval, INTERVAL_CHOICES } from '@/lib/watering';
import { PLANT_PHOTO_LIMIT, type Category, type IdStatus, type Plant } from '@/lib/types';

type Parent = { id: string | null; name: string };
type QualChoice = 'none' | Qualifier;
const NO_PARENT: Parent = { id: null, name: '' };

export default function PlantEditScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="plant-form">
        <ScreenTitle>{id ? 'Edit My Plant' : 'New Plant'}</ScreenTitle>
        <MemberGate what={t('식물 등록', 'Adding plants', '植物の登録')}>
          <PlantForm />
        </MemberGate>
      </Page>
    </View>
  );
}

function PlantForm() {
  const params = useLocalSearchParams<{ id?: string; category?: string }>();
  const plantsQ = usePlants();
  const catsQ = useCategories();
  if (plantsQ.isLoading || catsQ.isLoading) return <Loading />;
  const plants = plantsQ.data ?? [];
  const cats = catsQ.data ?? [];
  const existing = params.id ? plants.find((p) => p.id === params.id) ?? null : null;
  if (params.id && !existing) return <Loading />;
  // From a category page the new plant starts in that category.
  const preset = params.category && cats.some((c) => c.id === params.category) ? params.category : null;
  return <PlantFormBody key={existing?.id ?? 'new'} existing={existing} plants={plants} cats={cats} presetCategory={preset} />;
}

/** Starts from the stored plant (edit) or empty (new); state is set once, when the form mounts. */
function PlantFormBody({ existing, plants, cats: loadedCats, presetCategory }: { existing: Plant | null; plants: Plant[]; cats: Category[]; presetCategory: string | null }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const prompt = usePrompt();
  const catEdit = useCategoryEdit();
  const cats = catEdit.cats.length ? catEdit.cats : loadedCats;
  // Plants saved before v0.1.1 have one free-text name: split it into its parts once.
  const initial = existing ? (existing.genus ? { genus: existing.genus, species: existing.species ?? '', cultivar: existing.cultivar ?? '' } : parseName(existing.scientific_name)) : { genus: '', species: '', cultivar: '' };
  const [category, setCategory] = useState<string | null>(existing?.category_id ?? presetCategory);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [photos, setPhotos] = useState<FormPhoto[]>(() => (existing?.photo_paths ?? []).map((path) => ({ key: path, path })));
  const finds = useFinds().data ?? [];
  const records = [...plants, ...finds];
  const [genus, setGenus] = useState(initial.genus);
  // 과: filled from earlier records of the same genus until typed by hand.
  const [family, setFamily] = useState(() => existing?.family || familyForGenus(records, initial.genus));
  const [familyTyped, setFamilyTyped] = useState(!!existing?.family);
  const changeGenus = (v: string) => {
    setGenus(v);
    if (!familyTyped) setFamily(familyForGenus(records, v));
  };
  const changeFamily = (v: string) => {
    setFamily(v);
    setFamilyTyped(true);
  };
  // "cf. echinolabium" stored before v0.1.5, or typed into the box, becomes qualifier + epithet.
  const initialSplit = splitQualifier(initial.species, existing?.qualifier ?? null);
  const [qualifier, setQualifier] = useState<QualChoice>(initialSplit.qualifier ?? 'none');
  const [species, setSpecies] = useState(initialSplit.species);
  const [cultivar, setCultivar] = useState(initial.cultivar);
  const [origin, setOrigin] = useState<PlaceValue>({ region: existing?.origin_region ?? null, place: existing?.origin_place ?? null });
  const [seed, setSeed] = useState<Parent>(existing ? { id: existing.seed_parent_id, name: existing.seed_parent_name ?? '' } : NO_PARENT);
  const [pollen, setPollen] = useState<Parent>(existing ? { id: existing.pollen_parent_id, name: existing.pollen_parent_name ?? '' } : NO_PARENT);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [shop, setShop] = useState(existing?.shop ?? '');
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [status, setStatus] = useState<IdStatus>(existing?.identification_status ?? 'unidentified');
  // '' or 'auto' = automatic (records average); a number of days otherwise.
  const [interval, setIntervalChoice] = useState(existing?.watering_interval_days ? String(existing.watering_interval_days) : 'auto');
  const [sheet, setSheet] = useState<'seed' | 'pollen' | null>(null);
  const [busy, setBusy] = useState(false);
  const resolve = useSignedUrls(photos.map((p) => p.path));

  const isSp = qualifier === 'sp.';
  const split = splitQualifier(species, qualifier === 'none' ? null : qualifier);
  const name = composeName({ genus, qualifier: split.qualifier, species: split.species, cultivar, seed: seed.name, pollen: pollen.name });
  const changeQualifier = (q: QualChoice) => {
    setQualifier(q);
    if (q === 'sp.') setSpecies('');
  };
  const typed = genus.trim().toLowerCase();
  const genusChoices = knownGenera(records)
    .filter((g) => !typed || (g.toLowerCase().startsWith(typed) && g.toLowerCase() !== typed))
    .slice(0, 12);
  // A category that was deleted elsewhere counts as none.
  const categoryId = category && cats.some((c) => c.id === category) ? category : null;
  // The typed genus can become a category of its own at the top of My Plants (or pick the one that exists) in one tap.
  const typedGenus = normalizeGenus(genus);
  const sameName = (name: string) => name.toLowerCase() === typedGenus.toLowerCase();
  const genusTop = typedGenus ? (childrenOf(cats, null).find((c) => sameName(c.name)) ?? null) : null;
  const chosen = cats.find((c) => c.id === categoryId) ?? null;
  // Hidden once the chosen category already carries the genus name (at any level).
  const genusShortcut = typedGenus && !(chosen && sameName(chosen.name)) ? (genusTop ? 'pick' : 'create') : null;
  const applyGenusCategory = async () => {
    if (genusTop) return setCategory(genusTop.id);
    const id = await catEdit.create(typedGenus, null);
    if (id) setCategory(id);
  };

  // Shops: MATTER shop names and shops used before.
  const matterShops = useShops().data ?? [];
  const knownShops = [...new Set([...matterShops.map((x) => x.name), ...plants.map((x) => x.shop).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  const shopTyped = shop.trim().toLowerCase();
  const shopChoices = knownShops.filter((x) => !shopTyped || (x.toLowerCase().includes(shopTyped) && x.toLowerCase() !== shopTyped)).slice(0, 8);

  const pickParent = async (role: 'seed' | 'pollen', choice: Parent | 'custom') => {
    setSheet(null);
    let value: Parent;
    if (choice === 'custom') {
      if (Platform.OS === 'ios') await new Promise((r) => setTimeout(r, 450));
      const current = role === 'seed' ? seed : pollen;
      const typedName = await prompt({ title: role === 'seed' ? t('모본 이름', 'Seed parent', '母本の名前') : t('부본 이름', 'Pollen parent', '父本の名前'), placeholder: 'Bulbophyllum …', maxLength: 160, initial: current.id ? '' : current.name });
      if (!typedName) return;
      value = { id: null, name: typedName };
    } else value = choice;
    if (role === 'seed') setSeed(value);
    else setPollen(value);
  };

  const save = async () => {
    if (!user) return;
    const g = normalizeGenus(genus);
    if (!g) return notify(t('속을 입력해 주세요', 'Enter the genus', '属を入力してください'), t('예: Bulbophyllum', 'e.g. Bulbophyllum', '例：Bulbophyllum'));
    const auto = !interval || interval === 'auto';
    const intervalDays = auto ? null : cleanInterval(interval);
    if (!auto && intervalDays === null) return notify(t('관수 주기는 1에서 365 사이의 숫자로 넣어 주세요', 'Enter a watering interval from 1 to 365 days', '水やり間隔は1〜365の数字で入れてください'));
    setBusy(true);
    try {
      const id = existing?.id ?? randomUUID();
      const photo_paths = await storeFormPhotos(USER_BUCKET, userFolder(user.id, 'plants', id), photos);
      const row: PlantInput = {
        id,
        category_id: categoryId,
        scientific_name: composeName({ genus: g, qualifier: split.qualifier, species: split.species, cultivar, seed: seed.name, pollen: pollen.name }) || g,
        qualifier: split.qualifier,
        family: normalizeFamily(family),
        genus: g,
        species: split.species || null,
        cultivar: cleanCultivar(cultivar) || null,
        nickname: nickname.trim().slice(0, 80),
        identification_status: status,
        origin_region: origin.region,
        origin_place: origin.region ? origin.place : null,
        seed_parent_id: seed.id,
        seed_parent_name: seed.name.trim() ? seed.name.trim().slice(0, 160) : null,
        pollen_parent_id: pollen.id,
        pollen_parent_name: pollen.name.trim() ? pollen.name.trim().slice(0, 160) : null,
        notes: notes.trim().slice(0, 2000),
        photo_paths,
        is_private: isPrivate,
        shop: shop.replace(/\s+/g, ' ').trim().slice(0, 100),
        last_watered_on: existing?.last_watered_on ?? null,
        watering_interval_days: intervalDays,
      };
      await savePlant(user.id, row, existing, plants);
      await Promise.all([qc.invalidateQueries({ queryKey: ['plants'] }), qc.invalidateQueries({ queryKey: ['categories'] })]);
      if (existing) router.back();
      else router.replace(`/plants/${id}`);
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <PhotoField label={t('사진', 'Photos', '写真')} photos={photos} onChange={setPhotos} max={PLANT_PHOTO_LIMIT} resolve={resolve} testID="plant-photos" />
      <SelectBox
        label={t('카테고리', 'Category', 'カテゴリ')}
        value={pathLabel(cats, categoryId)}
        placeholder={noCategoryLabel(t)}
        onPress={() => setPickingCategory(true)}
        hint={t(
          '카테고리는 3단계까지 나눌 수 있습니다 (예: Orchid › Bulbophyllum › 유묘). 원하는 단계까지 고르세요. 새 카테고리도 여기서 생성할 수 있습니다.',
          'Categories go up to three levels (e.g. Orchid › Bulbophyllum › Seedlings). Pick any level; you can create new ones here too.',
          'カテゴリは3段階まで分けられます（例：Orchid › Bulbophyllum › 実生）。好きな段階まで選べます。新しいカテゴリもここで作成できます。',
        )}
        testID="plant-category"
      />

      <SectionHead>{t('학명', 'SCIENTIFIC NAME', '学名')}</SectionHead>
      <FamilyField value={family} onChange={changeFamily} known={knownFamilies(records)} testID="plant-family" />
      <Field
        label={t('속 (Genus)', 'Genus', '属 (Genus)')}
        required
        value={genus}
        onChangeText={changeGenus}
        placeholder="Bulbophyllum"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        hint={genusChoices.length ? t('아래 버튼으로 전에 쓴 속을 고를 수 있습니다.', 'Tap a button below to reuse a genus.', '下のボタンで以前の属を選べます。') : undefined}
        testID="plant-genus"
      />
      {!!genusChoices.length && (
        <View style={styles.chips} testID="genus-choices">
          {genusChoices.map((g) => (
            <Pressable key={g} onPress={() => changeGenus(g)} style={styles.chip} accessibilityRole="button" testID={`genus-choice-${g}`}>
              <Txt italic size={13}>
                {g}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      {genusShortcut && (
        <Pressable onPress={applyGenusCategory} style={styles.shortcut} accessibilityRole="button" testID="genus-category">
          {genusShortcut === 'create' && <Plus size={16} />}
          <Txt size={13} style={{ marginLeft: genusShortcut === 'create' ? 6 : 0, flexShrink: 1 }}>
            {genusShortcut === 'create'
              ? t(`'${typedGenus}' 속으로 카테고리 생성`, `Create category '${typedGenus}' from the genus`, `属「${typedGenus}」でカテゴリを作成`)
              : t(`'${genusTop?.name}' 카테고리에 넣기`, `Put in category '${genusTop?.name}'`, `カテゴリ「${genusTop?.name}」に入れる`)}
          </Txt>
        </Pressable>
      )}
      <Label>{t('한정어 (선택)', 'Qualifier (optional)', '限定詞（任意）')}</Label>
      <Segmented<QualChoice>
        value={qualifier}
        onChange={changeQualifier}
        options={[
          { value: 'none', label: t('없음', 'None', 'なし') },
          { value: 'sp.', label: 'sp.' },
          { value: 'cf.', label: 'cf.' },
          { value: 'aff.', label: 'aff.' },
        ]}
        testID="plant-qualifier"
      />
      <Txt size={10} color={C.muted} style={{ marginTop: -8, marginBottom: 16, lineHeight: 15 }}>
        {t('sp. 속까지만 동정 · cf. 이 종으로 보이지만 확실하지 않음 · aff. 이 종과 가깝지만 다른 종일 수 있음.', 'sp. identified to genus only · cf. looks like this species but not confirmed · aff. close to this species but possibly another.', 'sp. 属まで同定・cf. この種に見えるが未確定・aff. この種に近いが別種の可能性。')}
      </Txt>
      <Field label={t('종소명 (선택)', 'Species (optional)', '種小名（任意）')} value={species} onChangeText={setSpecies} editable={!isSp} style={isSp ? styles.off : undefined} placeholder={isSp ? t('sp.를 고르면 쓰지 않습니다', 'Not used with sp.', 'sp.では使いません') : t('예: echinolabium · 모르면 비워 두세요', 'e.g. echinolabium · leave empty if unknown', '例：echinolabium・不明なら空欄')} autoCapitalize="none" autoCorrect={false} maxLength={100} testID="plant-species" />
      <Field label={t('추가 식별명 (선택)', 'Additional name (optional)', '追加識別名（任意）')} value={cultivar} onChangeText={setCultivar} placeholder={t('예: Red Dragon, Dwarf', 'e.g. Red Dragon, Dwarf', '例：Red Dragon, Dwarf')} autoCorrect={false} maxLength={100} testID="plant-cultivar" />
      <NamePreview empty={name ? undefined : t('속을 입력하면 이름이 여기에 표시됩니다', 'The name appears here once you type the genus', '属を入力すると名前がここに表示されます')} testID="plant-name-preview">
        <Txt italic size={16} testID="plant-name-preview-text">
          {name}
        </Txt>
      </NamePreview>

      <SectionHead>{t('원산지', 'ORIGIN', '原産地')}</SectionHead>
      <PlacePicker mode="origin" label={t('원산지', 'Origin', '原産地')} value={origin} onChange={setOrigin} testID="plant-origin" />

      <SectionHead>{t('모본 × 부본 (선택)', 'SEED × POLLEN PARENT (OPTIONAL)', '母本 × 父本（任意）')}</SectionHead>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectBox label={t('모본 (♀)', 'Seed (♀)', '母本 (♀)')} value={seed.name} placeholder={t('없음', 'None', 'なし')} onPress={() => setSheet('seed')} testID="plant-seed" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectBox label={t('부본 (♂)', 'Pollen (♂)', '父本 (♂)')} value={pollen.name} placeholder={t('없음', 'None', 'なし')} onPress={() => setSheet('pollen')} testID="plant-pollen" />
        </View>
      </View>
      <Txt size={10} color={C.muted} style={{ marginTop: -6, marginBottom: 14, lineHeight: 15 }}>
        {t('모본: 씨를 맺은 쪽 · 부본: 꽃가루를 준 쪽. 비워 둬도 됩니다. 둘 다 고르고 종소명을 비우면 이름이 "모본 × 부본"이 됩니다.', 'Seed parent bears the seed, pollen parent gives the pollen. Both are optional. With both set and no species, the name becomes "seed × pollen".', '母本：種子をつけた側・父本：花粉を与えた側。空欄でも構いません。両方を選び種小名が空なら「母本 × 父本」になります。')}
      </Txt>

      <Field label={t('구입처 (선택)', 'Shop (optional)', '購入先（任意）')} value={shop} onChangeText={setShop} placeholder={t('예: 책방의 게코', 'e.g. a shop name', '例：ショップ名')} maxLength={100} hint={knownShops.length ? t('아래 버튼으로 MATTER 매장이나 전에 쓴 구입처를 고를 수 있습니다.', 'Tap a button below for a MATTER shop or a shop used before.', '下のボタンでMATTERのショップや以前の購入先を選べます。') : undefined} testID="plant-shop" />
      {!!shopChoices.length && (
        <View style={styles.chips} testID="shop-choices">
          {shopChoices.map((x) => (
            <Pressable key={x} onPress={() => setShop(x)} style={styles.chip} accessibilityRole="button" testID={`shop-choice-${x}`}>
              <Txt size={13}>{x}</Txt>
            </Pressable>
          ))}
        </View>
      )}
      <ChoiceChips
        label={t('관수 주기', 'Watering interval', '水やり間隔')}
        value={interval}
        onChange={setIntervalChoice}
        options={[{ value: 'auto', label: t('자동', 'Auto', '自動') }, ...INTERVAL_CHOICES.map((n) => ({ value: String(n), label: t(`${n}일`, `${n} d`, `${n}日`) }))]}
        custom={{ label: t('직접 입력', 'Other', '直接入力'), placeholder: t('일 수 (예: 9)', 'days (e.g. 9)', '日数（例：9）') }}
        testID="plant-interval"
      />
      <Txt size={10} color={C.muted} style={{ marginTop: -8, marginBottom: 16, lineHeight: 15 }}>
        {t('자동: 물 준 기록의 평균으로 다음 관수를 추천합니다 (기록 3번부터). 주기를 고르면 그 주기로 추천합니다.', 'Auto: the next watering is suggested from the average of your records (from 3 records). A chosen interval is used instead.', '自動：水やり記録の平均から次の水やりを提案します（記録3回から）。間隔を選ぶとその間隔で提案します。')}
      </Txt>
      <Field label={t('메모', 'Notes', 'メモ')} value={notes} onChangeText={setNotes} multiline maxLength={2000} testID="plant-notes" />
      <VisibilityField label={t('공개 설정', 'Visibility', '公開設定')} isPrivate={isPrivate} onChange={setIsPrivate} testID="plant-visibility" />

      <SectionHead>{t('선택 항목', 'OPTIONAL', '任意項目')}</SectionHead>
      <Field label={t('별칭', 'Nickname', 'ニックネーム')} value={nickname} onChangeText={setNickname} maxLength={80} testID="plant-nickname" />
      <Segmented value={status} onChange={setStatus} options={ID_STATUSES.map((s) => ({ value: s, label: idStatusLabel(s, locale) }))} testID="plant-status" />

      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} style={{ marginTop: 8 }} testID="plant-save" />

      {(['seed', 'pollen'] as const).map((role) => (
        <Sheet key={role} visible={sheet === role} title={role === 'seed' ? t('모본 (♀)', 'Seed parent (♀)', '母本 (♀)') : t('부본 (♂)', 'Pollen parent (♂)', '父本 (♂)')} onClose={() => setSheet(null)} testID={`${role}-sheet`}>
          <SheetItem label={t('없음', 'None', 'なし')} selected={!(role === 'seed' ? seed : pollen).name} onPress={() => pickParent(role, NO_PARENT)} testID={`${role}-none`} />
          <SheetItem label={t('직접 입력…', 'Type a name…', '直接入力…')} onPress={() => pickParent(role, 'custom')} testID={`${role}-custom`} />
          {plants
            .filter((p) => p.id !== existing?.id)
            .map((p) => (
              <SheetItem
                key={p.id}
                label={p.scientific_name}
                sub={pathLabel(cats, p.category_id) || undefined}
                selected={(role === 'seed' ? seed : pollen).id === p.id}
                onPress={() => pickParent(role, { id: p.id, name: p.scientific_name })}
                testID={`${role}-pick-${p.id}`}
              />
            ))}
        </Sheet>
      ))}
      <CategoryPicker
        visible={pickingCategory}
        title={t('카테고리', 'Category', 'カテゴリ')}
        cats={cats}
        value={categoryId}
        noneLabel={noCategoryLabel(t)}
        onPick={(id) => {
          setCategory(id);
          setPickingCategory(false);
        }}
        onCreate={catEdit.create}
        onClose={() => setPickingCategory(false)}
        testID="category-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  off: { opacity: 0.4, backgroundColor: '#ECECEC' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 16 },
  shortcut: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderColor: C.ink, paddingHorizontal: 12, paddingVertical: 8, marginTop: -6, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#C9C9C9', backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 6 },
});
