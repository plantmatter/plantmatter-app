import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { PhotoField } from '@/components/photos';
import { PlacePicker, type PlaceValue } from '@/components/place-picker';
import { NamePreview } from '@/components/sci-name';
import { usePrompt } from '@/components/prompt';
import { Sheet, SheetItem } from '@/components/sheet';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, Field, Loading, Page, ScreenTitle, SectionHead, Segmented, SelectBox, VisibilityField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { categoryPath, savePlant, topCategories, useCategories, usePlants, useShops, type PlantInput } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { ID_STATUSES, idStatusLabel } from '@/lib/labels';
import { cleanCultivar, composeName, normalizeGenus, parseName } from '@/lib/names';
import { storeFormPhotos, useSignedUrls, userFolder, type FormPhoto } from '@/lib/photos';
import { errorText, USER_BUCKET } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { PLANT_PHOTO_LIMIT, type Category, type IdStatus, type Plant } from '@/lib/types';

type Parent = { id: string | null; name: string };
const NO_PARENT: Parent = { id: null, name: '' };

export default function PlantEditScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="plant-form">
        <ScreenTitle>{id ? 'Edit Plant' : 'New Plant'}</ScreenTitle>
        <MemberGate what={t('식물 등록', 'Adding plants', '植物の登録')}>
          <PlantForm />
        </MemberGate>
      </Page>
    </View>
  );
}

function PlantForm() {
  const params = useLocalSearchParams<{ id?: string; genus?: string }>();
  const plantsQ = usePlants();
  const catsQ = useCategories();
  if (plantsQ.isLoading || catsQ.isLoading) return <Loading />;
  const plants = plantsQ.data ?? [];
  const cats = catsQ.data ?? [];
  const existing = params.id ? plants.find((p) => p.id === params.id) ?? null : null;
  if (params.id && !existing) return <Loading />;
  return <PlantFormBody key={existing?.id ?? 'new'} existing={existing} plants={plants} cats={cats} presetGenus={params.genus ?? ''} />;
}

/** Starts from the stored plant (edit) or empty (new); state is set once, when the form mounts. */
function PlantFormBody({ existing, plants, cats, presetGenus }: { existing: Plant | null; plants: Plant[]; cats: Category[]; presetGenus: string }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const prompt = usePrompt();
  // Plants saved before v0.1.1 have one free-text name: split it into its parts once.
  const initial = existing ? (existing.genus ? { genus: existing.genus, species: existing.species ?? '', cultivar: existing.cultivar ?? '' } : parseName(existing.scientific_name)) : { genus: presetGenus, species: '', cultivar: '' };
  const [photos, setPhotos] = useState<FormPhoto[]>(() => (existing?.photo_paths ?? []).map((path) => ({ key: path, path })));
  const [genus, setGenus] = useState(initial.genus);
  const [species, setSpecies] = useState(initial.species);
  const [cultivar, setCultivar] = useState(initial.cultivar);
  const [origin, setOrigin] = useState<PlaceValue>({ region: existing?.origin_region ?? null, place: existing?.origin_place ?? null });
  const [seed, setSeed] = useState<Parent>(existing ? { id: existing.seed_parent_id, name: existing.seed_parent_name ?? '' } : NO_PARENT);
  const [pollen, setPollen] = useState<Parent>(existing ? { id: existing.pollen_parent_id, name: existing.pollen_parent_name ?? '' } : NO_PARENT);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [shop, setShop] = useState(existing?.shop ?? '');
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [status, setStatus] = useState<IdStatus>(existing?.identification_status ?? 'unidentified');
  const [sheet, setSheet] = useState<'seed' | 'pollen' | null>(null);
  const [busy, setBusy] = useState(false);
  const resolve = useSignedUrls(photos.map((p) => p.path));

  const name = composeName({ genus, species, cultivar, seed: seed.name, pollen: pollen.name });
  const typed = genus.trim().toLowerCase();
  const genusChoices = topCategories(cats)
    .map((c) => c.name)
    .filter((g) => !typed || (g.toLowerCase().startsWith(typed) && g.toLowerCase() !== typed))
    .slice(0, 12);

  // Shops: MATTER shop names and shops used before.
  const matterShops = useShops().data ?? [];
  const knownShops = [...new Set([...matterShops.map((x) => x.name), ...plants.map((x) => x.shop).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  const shopTyped = shop.trim().toLowerCase();
  const shopChoices = knownShops.filter((x) => !shopTyped || (x.toLowerCase().includes(shopTyped) && x.toLowerCase() !== shopTyped)).slice(0, 8);

  const pickParent = async (role: 'seed' | 'pollen', choice: Parent | 'custom') => {
    setSheet(null);
    let value: Parent;
    if (choice === 'custom') {
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
    if (!g) return notify(t('속을 입력해 주세요', 'Enter the genus', '属を入力してください'), t('예: Bulbophyllum. 입력한 속이 My Plants의 분류가 됩니다.', 'e.g. Bulbophyllum. The genus becomes the My Plants category.', '例：Bulbophyllum。入力した属がMy Plantsの分類になります。'));
    setBusy(true);
    try {
      const id = existing?.id ?? randomUUID();
      const photo_paths = await storeFormPhotos(USER_BUCKET, userFolder(user.id, 'plants', id), photos);
      const row: PlantInput = {
        id,
        scientific_name: composeName({ genus: g, species, cultivar, seed: seed.name, pollen: pollen.name }) || g,
        genus: g,
        species: species.trim().slice(0, 100) || null,
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
      };
      await savePlant(user.id, row, existing, cats, plants);
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

      <SectionHead>{t('학명', 'SCIENTIFIC NAME', '学名')}</SectionHead>
      <Field
        label={t('속 (Genus)', 'Genus', '属 (Genus)')}
        required
        value={genus}
        onChangeText={setGenus}
        placeholder="Bulbophyllum"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        hint={t('입력한 속이 My Plants의 분류가 됩니다. 아래 버튼으로 전에 쓴 속을 고를 수 있습니다.', 'The genus becomes the My Plants category. Tap a button below to reuse one.', '入力した属がMy Plantsの分類になります。下のボタンで以前の属を選べます。')}
        testID="plant-genus"
      />
      {!!genusChoices.length && (
        <View style={styles.chips} testID="genus-choices">
          {genusChoices.map((g) => (
            <Pressable key={g} onPress={() => setGenus(g)} style={styles.chip} accessibilityRole="button" testID={`genus-choice-${g}`}>
              <Txt italic size={13}>
                {g}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      <Field label={t('종소명 (선택)', 'Species (optional)', '種小名（任意）')} value={species} onChangeText={setSpecies} placeholder={t('예: echinolabium · 모르면 비워 두세요', 'e.g. echinolabium · leave empty if unknown', '例：echinolabium・不明なら空欄')} autoCapitalize="none" autoCorrect={false} maxLength={100} testID="plant-species" />
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
                sub={categoryPath(cats, p.category_id) || undefined}
                selected={(role === 'seed' ? seed : pollen).id === p.id}
                onPress={() => pickParent(role, { id: p.id, name: p.scientific_name })}
                testID={`${role}-pick-${p.id}`}
              />
            ))}
        </Sheet>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#C9C9C9', backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 6 },
});
