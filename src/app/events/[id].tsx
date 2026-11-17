import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { AdminActions } from '@/components/admin-actions';
import { PhotoPager } from '@/components/photos';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deleteEvent, useEvents } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
import { eventDate, eventEnd, safeHttpsUrl, todayStr } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { publicMediaUrl } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function EventDetail() {
  const { t, locale } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { admin } = useAuth();
  const qc = useQueryClient();
  const q = useEvents();
  const [busy, setBusy] = useState(false);
  const e = (q.data ?? []).find((x) => x.id === id);
  const remove = async () => {
    if (!e) return;
    if (!(await confirmAsync(t(`‘${e.title}’ 행사를 삭제할까요?`, `Delete “${e.title}”?`, `「${e.title}」を削除しますか？`), t('포스터 파일도 함께 지워집니다.', 'Its posters are deleted too.', 'ポスターも削除されます。'), t('삭제', 'Delete', '削除'), t('취소', 'Cancel', 'キャンセル'), true))) return;
    setBusy(true);
    try {
      await deleteEvent(e);
      await qc.invalidateQueries({ queryKey: ['events'] });
      router.back();
    } catch (err) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(err));
      setBusy(false);
    }
  };
  const link = e ? safeHttpsUrl(e.link_url) : '';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="event-detail">
        {q.isLoading ? (
          <Loading />
        ) : !e ? (
          <Notice>{t('행사를 찾을 수 없습니다.', 'Event not found.', 'イベントが見つかりません。')}</Notice>
        ) : (
          <View>
            <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 10 }}>EVENT</Txt>
            <PhotoPager uris={e.poster_paths.map(publicMediaUrl)} aspect={3 / 4} testID="event-posters" />
            <Txt size={24} style={{ lineHeight: 32 }} testID="event-title">
              <Txt weight="bold" size={24}>{e.title}</Txt>
              {e.subtitle ? <Txt size={24}>{` ${e.subtitle}`}</Txt> : null}
            </Txt>
            <Txt size={14} style={{ marginTop: 8 }} testID="event-when">
              {eventDate(e, locale)}
              {eventEnd(e) < todayStr() ? ` · ${t('지난 행사', 'Past event', '終了したイベント')}` : ''}
            </Txt>
            <View style={{ marginTop: 16 }}>
              <InfoRow label={t('장소', 'Venue', '会場')} value={e.venue} />
            </View>
            {!!e.description && (
              <Txt size={13} color="#333" style={{ marginTop: 16, lineHeight: 21 }}>
                {e.description}
              </Txt>
            )}
            {!!link && <Button label={t('자세히 보기 ↗', 'MORE INFO ↗', '詳しく見る ↗')} onPress={() => Linking.openURL(link)} style={{ marginTop: 22 }} testID="event-link" />}
            {admin && <AdminActions onEdit={() => router.push(`/events/edit?id=${e.id}`)} onDelete={remove} busy={busy} />}
          </View>
        )}
      </Page>
    </View>
  );
}
