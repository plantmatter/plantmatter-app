import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { MemberGate } from '@/components/gate';
import { PhotoField } from '@/components/photos';
import { PlacePicker, type PlaceValue } from '@/components/place-picker';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, Field, Loading, Page, ScreenTitle, SectionHead, Segmented, VisibilityField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { topCategories, useCategories, useFinds } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { isDateStr, todayStr } from '@/lib/format';
import { isCountry, regionOf } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { ID_STATUSES, idStatusLabel } from '@/lib/labels';
import { composeName, displayName, normalizeGenus, parseName, UNIDENTIFIED } from '@/lib/names';
import { queuedAsFind, saveFind, useOutbox } from '@/lib/outbox';
import { useSignedUrls, type FormPhoto } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { FIND_PHOTO_LIMIT, type Find, type IdStatus } from '@/lib/types';

export default function FindEditScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="find-form">
        <ScreenTitle sub={t('정확한 장소는 남기지 않고, 나라 또는 넓은 지역까지만 기록합니다.', 'Only the country or a broad region is kept, never the exact spot.', '正確な場所は残さず、国または広い地域までを記録します。')}>{id ? 'Edit Observation' : 'New Observation'}</ScreenTitle>
        <MemberGate what={t('관찰 기록', 'My Observations', '観察記録')}>
          <FindForm />
        </MemberGate>
      </Page>
    </View>
  );
}

function FindForm() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const findsQ = useFinds();
  const queued = useOutbox(user?.id);
  if (!params.id) return <FindFormBody key="new" existing={null} />;
  const q = queued.find((x) => x.row.id === params.id);
  const existing = q && user ? queuedAsFind(user.id, q) : (findsQ.data ?? []).find((f) => f.id === params.id) ?? null;
  if (!existing) return findsQ.isLoading ? <Loading /> : null;
  return <FindFormBody key={existing.id} existing={existing} />;
}

type Existing = Find & { pending?: boolean };
/** Starts from the stored find (edit) or empty (new); state is set once, when the form mounts. */
function FindFormBody({ existing }: { existing: Existing | null }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [photos, setPhotos] = useState<FormPhoto[]>(() => (existing?.photo_paths ?? []).map((path) => ({ key: path, path })));
  // Observations saved before v0.1.1 have one free-text name: split it once.
  const initial = existing ? (existing.genus ? { genus: existing.genus, species: existing.species ?? '' } : parseName(existing.scientific_name)) : { genus: '', species: '' };
  const [genus, setGenus] = useState(initial.genus);
  const [species, setSpecies] = useState(initial.species);
  const [status, setStatus] = useState<IdStatus>(existing?.identification_status ?? 'unidentified');
  const [place, setPlace] = useState<PlaceValue>({ region: existing?.region ?? regionOf(existing?.country_code), place: existing?.country_code ?? null });
  const [observedOn, setObservedOn] = useState(existing?.observed_on ?? todayStr());
  const [habitat, setHabitat] = useState(existing?.habitat ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [busy, setBusy] = useState(false);

  const resolve = useSignedUrls(photos.map((p) => p.path));
  const cats = useCategories().data ?? [];
  const finds = useFinds().data ?? [];
  // Genera already used in My Plants and in earlier observations.
  const known = [...new Set([...topCategories(cats).map((c) => c.name), ...finds.map((f) => f.genus).filter((g): g is string => !!g)])].sort((a, b) => a.localeCompare(b));
  const typed = genus.trim().toLowerCase();
  const genusChoices = known.filter((g) => !typed || (g.toLowerCase().startsWith(typed) && g.toLowerCase() !== typed)).slice(0, 12);
  const name = composeName({ genus, species }) || UNIDENTIFIED;

  const save = async () => {
    if (!user) return;
    if (!isDateStr(observedOn)) return notify(t('관찰한 날짜를 골라 주세요', 'Choose the date', '日付を選んでください'));
    setBusy(true);
    try {
      const id = existing?.id ?? randomUUID();
      const result = await saveFind(
        user.id,
        {
          id,
          scientific_name: name.slice(0, 160),
          genus: normalizeGenus(genus) || null,
          species: species.trim().slice(0, 100) || null,
          identification_status: status,
          region: (isCountry(place.place) ? regionOf(place.place) : place.region) ?? null,
          country_code: isCountry(place.place) ? place.place : null,
          observed_on: observedOn,
          habitat: habitat.trim().slice(0, 200),
          notes: notes.trim().slice(0, 2000),
          is_private: isPrivate,
        },
        // Photos of a queued find are local copies; treat them as new uploads.
        photos.map((p) => (p.path && /^(file|content):/i.test(p.path) ? { key: p.key.split('/').pop()!.replace(/\.jpg$/, ''), uri: p.path } : p)),
        existing && !existing.pending ? existing.photo_paths : [],
      );
      await qc.invalidateQueries({ queryKey: ['finds'] });
      if (result === 'queued')
        notify(
          t('휴대폰에 보관했습니다', 'Kept on this phone', '端末に保管しました'),
          t('지금은 인터넷에 연결되어 있지 않습니다. 연결되면 자동으로 올라갑니다.', 'You are offline right now. It uploads automatically when you are back online.', '現在オフラインです。接続されると自動でアップロードします。'),
        );
      if (existing) router.back();
      else router.replace(`/finds/${id}`);
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <PhotoField label={t('사진', 'Photos', '写真')} photos={photos} onChange={setPhotos} max={FIND_PHOTO_LIMIT} resolve={resolve} testID="find-photos" />
      <SectionHead>{t('학명', 'SCIENTIFIC NAME', '学名')}</SectionHead>
      <Field
        label={t('속 (Genus)', 'Genus', '属 (Genus)')}
        value={genus}
        onChangeText={setGenus}
        placeholder="Nepenthes"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        hint={t('모르면 비워 두세요. 아래 버튼으로 전에 쓴 속을 고를 수 있습니다.', 'Leave empty if unknown. Tap a button below to reuse a genus.', '不明なら空欄で。下のボタンで以前の属を選べます。')}
        testID="find-genus"
      />
      {!!genusChoices.length && (
        <View style={styles.chips} testID="find-genus-choices">
          {genusChoices.map((g) => (
            <Pressable key={g} onPress={() => setGenus(g)} style={styles.chip} accessibilityRole="button" testID={`find-genus-choice-${g}`}>
              <Txt italic size={13}>
                {g}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      <Field label={t('종소명 (선택)', 'Species (optional)', '種小名（任意）')} value={species} onChangeText={setSpecies} placeholder="rajah" autoCapitalize="none" autoCorrect={false} maxLength={100} testID="find-species" />
      <View style={styles.preview} testID="find-name-preview">
        <Txt size={11} color={C.muted}>
          {t('저장될 이름', 'Saved as', '保存される名前')}
        </Txt>
        <Txt italic size={16} style={{ marginTop: 4 }}>
          {displayName(name, locale)}
        </Txt>
      </View>
      <Segmented value={status} onChange={setStatus} options={ID_STATUSES.map((s) => ({ value: s, label: idStatusLabel(s, locale) }))} testID="find-status" />

      <SectionHead>{t('관찰 장소와 날짜', 'PLACE AND DATE', '観察場所と日付')}</SectionHead>
      <PlacePicker mode="find" label={t('관찰한 나라·지역', 'Country or region', '観察した国・地域')} value={place} onChange={setPlace} testID="find-country" />
      <DateField label={t('관찰한 날짜', 'Date', '観察日')} value={observedOn} onChange={setObservedOn} required testID="find-date" />
      <Field label={t('서식 환경 (선택)', 'Habitat (optional)', '生育環境（任意）')} value={habitat} onChangeText={setHabitat} placeholder={t('예: 이끼 낀 바위, 계곡 옆', 'e.g. mossy rock by a stream', '例：苔むした岩、渓流沿い')} maxLength={200} testID="find-habitat" />
      <Field label={t('메모', 'Notes', 'メモ')} value={notes} onChangeText={setNotes} multiline maxLength={2000} testID="find-notes" />
      <VisibilityField label={t('공개 설정', 'Visibility', '公開設定')} isPrivate={isPrivate} onChange={setIsPrivate} testID="find-visibility" />
      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} testID="find-save" />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#C9C9C9', backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 6 },
  preview: { backgroundColor: C.white, padding: 12, borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 14 },
});
