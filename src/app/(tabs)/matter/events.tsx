import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GoArrow } from '@/components/icons';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useEvents } from '@/lib/data';
import { eventDate, pastEvents, upcomingEvents } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { MatterEvent } from '@/lib/types';

/** Lime event list: upcoming by date, past events faded below. */
export default function EventsScreen() {
  const { t, locale } = useLocale();
  const { admin } = useAuth();
  const q = useEvents();
  const up = upcomingEvents(q.data ?? []);
  const past = pastEvents(q.data ?? []);
  const row = (e: MatterEvent, isPast = false) => (
    <Pressable key={e.id} onPress={() => router.push(`/events/${e.id}`)} style={({ pressed }) => [styles.row, isPast && { opacity: 0.42 }, pressed && { opacity: 0.6 }]} accessibilityRole="button" testID={`event-row-${e.id}`}>
      <View style={{ flex: 1 }}>
        <Txt size={21} style={{ lineHeight: 28 }}>
          <Txt weight="bold" size={21}>{e.title}</Txt>
          {e.subtitle ? <Txt size={21}>{`\n${e.subtitle}`}</Txt> : null}
        </Txt>
        <Txt size={13} style={{ marginTop: 10 }} testID={`event-date-${e.id}`}>
          {eventDate(e, locale)}
        </Txt>
      </View>
      <GoArrow />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.lime }}>
      <TopBar onAdd={admin ? () => router.push('/events/edit') : undefined} addLabel={t('행사 추가', 'Add event', 'イベントを追加')} />
      <Page bg={C.lime} testID="events-screen">
        <Txt weight="bold" size={30} style={{ marginBottom: 6 }}>Event</Txt>
        {q.isLoading ? <Loading /> : q.error ? <Notice tone="warning">{errorText(q.error)}</Notice> : null}
        {up.map((e) => row(e))}
        {!q.isLoading && !up.length && (
          <Txt size={14} style={styles.empty}>
            {t('예정된 행사가 없습니다.', 'No upcoming events.', '予定されているイベントはありません。')}
          </Txt>
        )}
        {!!past.length && (
          <View testID="past-events">
            <Txt weight="bold" size={12} style={{ letterSpacing: 1, marginTop: 36 }}>
              {t('지난 행사', 'PAST EVENTS', '過去のイベント')}
            </Txt>
            {past.map((e) => row(e, true))}
          </View>
        )}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1.5, borderBottomColor: C.ink },
  empty: { paddingVertical: 18, borderBottomWidth: 1.5, borderBottomColor: C.ink },
});
