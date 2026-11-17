import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { PhotoField } from '@/components/photos';
import { PlacePicker, type PlaceValue } from '@/components/place-picker';
import { usePrompt } from '@/components/prompt';
import { Sheet, SheetItem } from '@/components/sheet';
import { TopBar } from '@/components/top-bar';
import { Button, Field, Loading, Page, ScreenTitle, SectionHead, Segmented, SelectBox, ToggleRow } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { categoryPath, savePlant, subCategories, topCategories, useCategories, usePlants } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { crossName } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { ID_STATUSES, idStatusLabel } from '@/lib/labels';
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
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const plantsQ = usePlants();
  const catsQ = useCategories();
  if (plantsQ.isLoading || catsQ.isLoading) return <Loading />;
  const plants = plantsQ.data ?? [];
  const cats = catsQ.data ?? [];
  const existing = params.id ? plants.find((p) => p.id === params.id) ?? null : null;
  if (params.id && !existing) return <Loading />;
  const preset = params.categoryId && cats.some((c) => c.id === params.categoryId) ? params.categoryId : null;
  return <PlantFormBody key={existing?.id ?? 'new'} existing={existing} plants={plants} cats={cats} presetCategory={preset} />;
}

/** Starts from the stored plant (edit) or empty (new); state is set once, when the form mounts. */
function PlantFormBody({ existing, plants, cats, presetCategory }: { existing: Plant | null; plants: Plant[]; cats: Category[]; presetCategory: string | null }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const prompt = usePrompt();
  const [photos, setPhotos] = useState<FormPhoto[]>(() => (existing?.photo_paths ?? []).map((path) => ({ key: path, path })));
  const [name, setName] = useState(existing?.scientific_name ?? '');
  // The name follows "seed × pollen" until the user types a different one.
  const [nameAuto, setNameAuto] = useState(!existing || existing.scientific_name === crossName(existing.seed_parent_name, existing.pollen_parent_name));
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing ? existing.category_id : presetCategory);
  const [status, setStatus] = useState<IdStatus>(existing?.identification_status ?? 'unidentified');
  const [origin, setOrigin] = useState<PlaceValue>({ region: existing?.origin_region ?? null, place: existing?.origin_place ?? null });
  const [seed, setSeed] = useState<Parent>(existing ? { id: existing.seed_parent_id, name: existing.seed_parent_name ?? '' } : NO_PARENT);
  const [pollen, setPollen] = useState<Parent>(existing ? { id: existing.pollen_parent_id, name: existing.pollen_parent_name ?? '' } : NO_PARENT);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [sheet, setSheet] = useState<'category' | 'seed' | 'pollen' | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = useSignedUrls(photos.map((p) => p.path));

  const parentChoices = plants.filter((p) => p.id !== existing?.id);
  const parentLabel = (p: Parent) => p.name || '';
  const pickParent = async (role: 'seed' | 'pollen', choice: Parent | 'custom') => {
    setSheet(null);
    let value: Parent;
    if (choice === 'custom') {
      const typed = await prompt({ title: role === 'seed' ? t('모본 이름', 'Seed parent', '母本の名前') : t('부본 이름', 'Pollen parent', '父本の名前'), placeholder: 'Bulbophyllum …', maxLength: 160, initial: (role === 'seed' ? seed : pollen).id ? '' : (role === 'seed' ? seed : pollen).name });
      if (!typed) return;
      value = { id: null, name: typed };
    } else value = choice;
    const nextSeed = role === 'seed' ? value : seed;
    const nextPollen = role === 'pollen' ? value : pollen;
    if (role === 'seed') setSeed(value);
    else setPollen(value);
    const auto = crossName(nextSeed.name, nextPollen.name);
    if (auto && nameAuto) setName(auto);
  };
  const onName = (v: string) => {
    setName(v);
    setNameAuto(!v.trim() || v === crossName(seed.name, pollen.name));
  };

  const save = async () => {
    if (!user) return;
    const cleanName = name.trim();
    if (!cleanName) return notify(t('이름을 입력해 주세요', 'Enter a name', '名前を入力してください'));
    setBusy(true);
    try {
      const id = existing?.id ?? randomUUID();
      const photo_paths = await storeFormPhotos(USER_BUCKET, userFolder(user.id, 'plants', id), photos);
      const row: Omit<Plant, 'owner_id' | 'created_at' | 'updated_at'> = {
        id,
        category_id: categoryId,
        scientific_name: cleanName.slice(0, 160),
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
      };
      await savePlant(user.id, row, existing);
      await qc.invalidateQueries({ queryKey: ['plants'] });
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
      <SelectBox label={t('분류', 'Category', '分類')} value={categoryId ? categoryPath(cats, categoryId) : ''} placeholder={t('미분류', 'Unsorted', '未分類')} onPress={() => setSheet('category')} testID="plant-category" />

      <SectionHead>{t('모본 × 부본', 'SEED × POLLEN PARENT', '母本 × 父本')}</SectionHead>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectBox label={t('모본 (♀)', 'Seed (♀)', '母本 (♀)')} value={parentLabel(seed)} placeholder={t('없음', 'None', 'なし')} onPress={() => setSheet('seed')} testID="plant-seed" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectBox label={t('부본 (♂)', 'Pollen (♂)', '父本 (♂)')} value={parentLabel(pollen)} placeholder={t('없음', 'None', 'なし')} onPress={() => setSheet('pollen')} testID="plant-pollen" />
        </View>
      </View>

      <Field
        label={t('이름 / 학명', 'Name / scientific name', '名前 / 学名')}
        required
        value={name}
        onChangeText={onName}
        placeholder="Begonia sp."
        maxLength={160}
        autoCapitalize="sentences"
        hint={t('모본과 부본을 모두 고르면 "모본 × 부본"이 자동으로 들어갑니다. 직접 고친 이름은 바뀌지 않습니다.', 'Choosing both parents fills in "seed × pollen". A name you typed yourself is never replaced.', '母本と父本を選ぶと「母本 × 父本」が自動で入ります。手で直した名前は変わりません。')}
        testID="plant-name"
      />
      <Field label={t('별칭 (선택)', 'Nickname (optional)', 'ニックネーム（任意）')} value={nickname} onChangeText={setNickname} maxLength={80} testID="plant-nickname" />
      <Segmented value={status} onChange={setStatus} options={ID_STATUSES.map((s) => ({ value: s, label: idStatusLabel(s, locale) }))} testID="plant-status" />
      <PlacePicker mode="origin" label={t('원산지', 'Origin', '原産地')} value={origin} onChange={setOrigin} testID="plant-origin" />
      <Field label={t('메모', 'Notes', 'メモ')} value={notes} onChangeText={setNotes} multiline maxLength={2000} testID="plant-notes" />
      <ToggleRow label={t('나만 보기', 'Only me', '自分だけ')} sub={t('친구 기능이 생기면 이 식물은 다른 사람에게 보이지 않습니다. (이번 버전은 모든 기록이 나만 보입니다)', 'When sharing arrives, this plant stays hidden from others. (In this version all records are private.)', '共有機能が追加されても、この植物は他の人に表示されません。（このバージョンではすべて自分だけ）')} value={isPrivate} onChange={setIsPrivate} testID="plant-private" />
      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} testID="plant-save" />

      <Sheet visible={sheet === 'category'} title={t('분류', 'Category', '分類')} onClose={() => setSheet(null)} testID="category-sheet">
        <SheetItem label={t('미분류', 'Unsorted', '未分類')} selected={!categoryId} onPress={() => { setCategoryId(null); setSheet(null); }} testID="category-none" />
        {topCategories(cats).map((c) => (
          <View key={c.id}>
            <SheetItem label={c.name} strong selected={categoryId === c.id} onPress={() => { setCategoryId(c.id); setSheet(null); }} testID={`category-${c.name}`} />
            {subCategories(cats, c.id).map((s) => (
              <SheetItem key={s.id} label={s.name} indent={1} selected={categoryId === s.id} onPress={() => { setCategoryId(s.id); setSheet(null); }} testID={`category-${s.name}`} />
            ))}
          </View>
        ))}
      </Sheet>
      {(['seed', 'pollen'] as const).map((role) => (
        <Sheet key={role} visible={sheet === role} title={role === 'seed' ? t('모본 (♀)', 'Seed parent (♀)', '母本 (♀)') : t('부본 (♂)', 'Pollen parent (♂)', '父本 (♂)')} onClose={() => setSheet(null)} testID={`${role}-sheet`}>
          <SheetItem label={t('없음', 'None', 'なし')} selected={!(role === 'seed' ? seed : pollen).name} onPress={() => pickParent(role, NO_PARENT)} testID={`${role}-none`} />
          <SheetItem label={t('직접 입력…', 'Type a name…', '直接入力…')} onPress={() => pickParent(role, 'custom')} testID={`${role}-custom`} />
          {parentChoices.map((p) => (
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
