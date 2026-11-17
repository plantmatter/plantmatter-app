import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/date-field';
import { MemberGate } from '@/components/gate';
import { PhotoField } from '@/components/photos';
import { PlacePicker, type PlaceValue } from '@/components/place-picker';
import { TopBar } from '@/components/top-bar';
import { Button, Field, Loading, Page, ScreenTitle, Segmented, ToggleRow } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFinds } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { isDateStr, todayStr } from '@/lib/format';
import { isCountry, regionOf } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { ID_STATUSES, idStatusLabel } from '@/lib/labels';
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
        <ScreenTitle sub={t('정확한 장소는 기록하지 않고 나라까지만 남깁니다.', 'Only the country is kept, never the exact spot.', '正確な場所は残さず、国だけを記録します。')}>{id ? 'Edit Find' : 'New Wild Find'}</ScreenTitle>
        <MemberGate what={t('야생 발견 기록', 'Wild Finds', '野外発見の記録')}>
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
  const [name, setName] = useState(existing?.scientific_name ?? '');
  const [status, setStatus] = useState<IdStatus>(existing?.identification_status ?? 'unidentified');
  const [place, setPlace] = useState<PlaceValue>({ region: regionOf(existing?.country_code), place: existing?.country_code ?? null });
  const [observedOn, setObservedOn] = useState(existing?.observed_on ?? todayStr());
  const [habitat, setHabitat] = useState(existing?.habitat ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [busy, setBusy] = useState(false);

  const resolve = useSignedUrls(photos.map((p) => p.path));

  const save = async () => {
    if (!user) return;
    if (!name.trim()) return notify(t('이름을 입력해 주세요', 'Enter a name', '名前を入力してください'), t('모르면 "미상" 또는 속 이름만 적어도 됩니다.', 'If unsure, a genus or "unknown" is fine.', 'わからなければ属名や「不明」でも構いません。'));
    if (!isDateStr(observedOn)) return notify(t('발견한 날짜를 골라 주세요', 'Choose the date', '日付を選んでください'));
    setBusy(true);
    try {
      const id = existing?.id ?? randomUUID();
      const result = await saveFind(
        user.id,
        {
          id,
          scientific_name: name.trim().slice(0, 160),
          identification_status: status,
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
      <Field label={t('이름 / 학명', 'Name / scientific name', '名前 / 学名')} required value={name} onChangeText={setName} placeholder="Nepenthes sp." maxLength={160} testID="find-name" />
      <Segmented value={status} onChange={setStatus} options={ID_STATUSES.map((s) => ({ value: s, label: idStatusLabel(s, locale) }))} testID="find-status" />
      <PlacePicker mode="country" label={t('발견한 나라', 'Country', '発見した国')} value={place} onChange={setPlace} testID="find-country" />
      <DateField label={t('발견한 날짜', 'Date found', '発見日')} value={observedOn} onChange={setObservedOn} required testID="find-date" />
      <Field label={t('서식 환경 (선택)', 'Habitat (optional)', '生育環境（任意）')} value={habitat} onChangeText={setHabitat} placeholder={t('예: 이끼 낀 바위, 계곡 옆', 'e.g. mossy rock by a stream', '例：苔むした岩、渓流沿い')} maxLength={200} testID="find-habitat" />
      <Field label={t('메모', 'Notes', 'メモ')} value={notes} onChangeText={setNotes} multiline maxLength={2000} testID="find-notes" />
      <ToggleRow label={t('나만 보기', 'Only me', '自分だけ')} sub={t('친구 기능이 생기면 이 기록은 다른 사람에게 보이지 않습니다.', 'When sharing arrives, this find stays hidden from others.', '共有機能が追加されても、この記録は他の人に表示されません。')} value={isPrivate} onChange={setIsPrivate} testID="find-private" />
      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} testID="find-save" />
    </View>
  );
}
