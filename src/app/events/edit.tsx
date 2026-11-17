import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/date-field';
import { PhotoField } from '@/components/photos';
import { TopBar } from '@/components/top-bar';
import { Button, Field, Loading, Notice, Page, ScreenTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { saveEvent, useEvents } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { isDateStr, safeHttpsUrl, todayStr } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { publicMediaUrl, storeFormPhotos, type FormPhoto } from '@/lib/photos';
import { errorText, MEDIA_BUCKET } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { POSTER_LIMIT, type MatterEvent } from '@/lib/types';

export default function EventEdit() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { admin } = useAuth();
  const q = useEvents();
  const existing = id ? (q.data ?? []).find((e) => e.id === id) ?? null : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="event-form">
        <ScreenTitle>{id ? 'Edit Event' : 'New Event'}</ScreenTitle>
        {!admin ? (
          <Notice tone="warning">{t('관리자만 행사를 등록할 수 있습니다.', 'Only admins can post events.', '管理者のみイベントを登録できます。')}</Notice>
        ) : id && !existing ? (
          <Loading />
        ) : (
          <EventFormBody key={existing?.id ?? 'new'} existing={existing} />
        )}
      </Page>
    </View>
  );
}

function EventFormBody({ existing }: { existing: MatterEvent | null }) {
  const { t } = useLocale();
  const qc = useQueryClient();
  const [posters, setPosters] = useState<FormPhoto[]>(() => (existing?.poster_paths ?? []).map((path) => ({ key: path, path })));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? '');
  const [startsOn, setStartsOn] = useState(existing?.starts_on ?? todayStr());
  const [endsOn, setEndsOn] = useState(existing?.ends_on ?? '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [link, setLink] = useState(existing?.link_url ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim() || !isDateStr(startsOn)) return notify(t('행사 이름과 시작일을 입력해 주세요', 'Enter the event name and start date', 'イベント名と開始日を入力してください'));
    if (endsOn && endsOn < startsOn) return notify(t('종료일이 시작일보다 빠릅니다', 'The end date is before the start date', '終了日が開始日より前です'));
    const url = safeHttpsUrl(link);
    if (url === null) return notify(t('링크는 https:// 로 시작해야 합니다', 'Links must start with https://', 'リンクは https:// で始めてください'));
    setBusy(true);
    try {
      const eventId = existing?.id ?? randomUUID();
      const poster_paths = await storeFormPhotos(MEDIA_BUCKET, `events/${eventId}`, posters);
      await saveEvent(
        { id: eventId, title: title.trim().slice(0, 80), subtitle: subtitle.trim().slice(0, 80), starts_on: startsOn, ends_on: endsOn || null, venue: venue.trim().slice(0, 160), description: description.trim().slice(0, 2000), link_url: url, poster_paths },
        existing,
      );
      await qc.invalidateQueries({ queryKey: ['events'] });
      if (existing) router.back();
      else router.replace(`/events/${eventId}`);
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <PhotoField
        label={t('포스터', 'Posters', 'ポスター')}
        photos={posters}
        onChange={setPosters}
        max={POSTER_LIMIT}
        maxSide={2000}
        resolve={publicMediaUrl}
        note={t('첫 장이 HOME 포스터입니다. 자르지 않고 저장하며, 세로 9:16 이미지가 HOME 화면에 가장 잘 맞습니다. 누구나 볼 수 있는 공개 사진입니다.', 'The first image is the HOME poster. Saved uncropped; portrait 9:16 fits HOME best. Posters are public.', '1枚目がHOMEのポスターです。切り取らずに保存し、縦9:16がHOMEに最適です。ポスターは公開されます。')}
        testID="event-posters-field"
      />
      <Field label={t('행사 이름 (굵게)', 'Event name (bold)', 'イベント名（太字）')} required value={title} onChangeText={setTitle} maxLength={80} testID="event-title-input" />
      <Field label={t('보조 제목 (가늘게, 선택)', 'Subtitle (light, optional)', 'サブタイトル（細字・任意）')} value={subtitle} onChangeText={setSubtitle} maxLength={80} testID="event-subtitle-input" />
      <DateField label={t('시작일', 'Starts', '開始日')} required value={startsOn} onChange={setStartsOn} testID="event-start" />
      <DateField label={t('종료일 (하루면 비움)', 'Ends (blank if one day)', '終了日（1日なら空欄）')} optional value={endsOn} onChange={setEndsOn} testID="event-end" />
      <Field label={t('장소', 'Venue', '会場')} value={venue} onChangeText={setVenue} maxLength={160} testID="event-venue" />
      <Field label={t('소개', 'Description', '紹介')} value={description} onChangeText={setDescription} multiline maxLength={2000} testID="event-description" />
      <Field label={t('링크 (예매·인스타그램 등)', 'Link (tickets, Instagram…)', 'リンク（チケット・Instagramなど）')} value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="https://" maxLength={500} testID="event-link-input" />
      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} testID="event-save" />
    </View>
  );
}
