import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { SetupNotice } from '@/components/gate';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Loading } from '@/components/ui';
import { useEvents } from '@/lib/data';
import { eventDate, upcomingEvents } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { publicMediaUrl } from '@/lib/photos';
import { configured } from '@/lib/supabase';
import { C } from '@/lib/theme';

/** HOME: full-screen posters of upcoming events (first poster of each, nearest first). Swipe by hand. */
export default function HomeScreen() {
  const { t, locale } = useLocale();
  const eventsQ = useEvents();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const list = upcomingEvents(eventsQ.data ?? []).filter((e) => e.poster_paths.length > 0);
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, size.w)));

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <TopBar left="logo" onMenu={() => router.navigate('/options')} />
      <View style={{ flex: 1 }} onLayout={onLayout} testID="home-screen">
        {!configured ? (
          <View style={{ padding: 22 }}>
            <SetupNotice />
          </View>
        ) : eventsQ.isLoading ? (
          <Loading />
        ) : list.length && size.w > 0 ? (
          <>
            <FlatList
              data={list}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(e) => e.id}
              onScroll={onScroll}
              onMomentumScrollEnd={onScroll}
              scrollEventThrottle={32}
              getItemLayout={(_, i) => ({ length: size.w, offset: size.w * i, index: i })}
              testID="home-posters"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/events/${item.id}`)}
                  style={{ width: size.w, height: size.h, backgroundColor: '#E9E9E9' }}
                  accessibilityRole="button"
                  accessibilityLabel={[item.title, item.subtitle, eventDate(item, locale)].filter(Boolean).join(' · ')}
                  testID={`poster-${item.id}`}>
                  <Image source={{ uri: publicMediaUrl(item.poster_paths[0]) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                </Pressable>
              )}
            />
            {list.length > 1 && (
              <View style={styles.dots} pointerEvents="none" testID="home-dots">
                {list.map((e, i) => (
                  <View key={e.id} style={[styles.dot, i === index && styles.dotOn]} testID={i === index ? 'home-dot-on' : undefined} />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.empty} testID="home-empty">
            <Image source={require('@/assets/images/wordmark.png')} style={{ width: 220, height: 18 }} contentFit="contain" />
            <Txt size={13} color="#777" style={{ marginTop: 22 }}>
              {t('예정된 행사가 없습니다.', 'No upcoming events.', '予定されているイベントはありません。')}
            </Txt>
            <Pressable onPress={() => router.navigate('/matter')} hitSlop={8} style={{ marginTop: 14 }} accessibilityRole="button">
              <Txt size={12} style={{ letterSpacing: 1.5 }}>
                MATTER →
              </Txt>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', left: 0, right: 0, bottom: 22, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.ink, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  dotOn: { backgroundColor: C.white, borderColor: C.ink, width: 11, height: 11, borderRadius: 6, marginTop: -1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
});
