import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { pickPhotos, type FormPhoto } from '@/lib/photos';
import { C } from '@/lib/theme';

import { Txt } from './txt';
import { Button, Label } from './ui';

/**
 * Photo grid in forms: album / camera, remove, tap a photo to make it the cover (first).
 * `resolve` turns a stored path into a displayable URL (signed or public).
 */
export function PhotoField({ label, photos, onChange, max, resolve, maxSide = 1600, note, testID }: { label: string; photos: FormPhoto[]; onChange: (p: FormPhoto[]) => void; max: number; resolve: (path: string) => string; maxSide?: number; note?: string; testID?: string }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const left = max - photos.length;
  const add = async (source: 'library' | 'camera') => {
    if (left <= 0 || busy) return;
    setBusy(true);
    try {
      const picked = await pickPhotos(source, left, maxSide);
      if (picked.length) onChange([...photos, ...picked].slice(0, max));
    } catch (e) {
      if (e instanceof Error && e.message === 'permission')
        notify(t('카메라 권한이 필요합니다', 'Camera access needed', 'カメラへのアクセスが必要です'), t('설정 앱에서 PLANT MATTER의 카메라 접근을 허용해 주세요.', 'Allow camera access for PLANT MATTER in Settings.', '設定アプリでPLANT MATTERのカメラを許可してください。'));
      else notify(t('사진을 불러오지 못했습니다', 'Could not load the photo', '写真を読み込めませんでした'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = (key: string) => onChange(photos.filter((p) => p.key !== key));
  const cover = (key: string) => {
    const p = photos.find((x) => x.key === key);
    if (p) onChange([p, ...photos.filter((x) => x.key !== key)]);
  };
  return (
    <View style={{ marginBottom: 18 }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>{`${label} (${photos.length}/${max})`}</Label>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button small kind="light" label={t('앨범', 'Album', 'アルバム')} onPress={() => add('library')} disabled={left <= 0} busy={busy} testID={testID ? `${testID}-album` : undefined} />
          <Button small kind="light" label={t('촬영', 'Camera', '撮影')} onPress={() => add('camera')} disabled={left <= 0 || busy} testID={testID ? `${testID}-camera` : undefined} />
        </View>
      </View>
      <View style={styles.grid}>
        {photos.map((p, i) => {
          const src = p.uri ?? (p.path ? resolve(p.path) : '');
          return (
            <View key={p.key} style={styles.thumb} testID={testID ? `${testID}-thumb` : undefined}>
              <Pressable onPress={() => cover(p.key)} style={StyleSheet.absoluteFill} accessibilityLabel={t('대표 사진으로', 'Make cover', 'カバーにする')}>
                {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </Pressable>
              {i === 0 && (
                <View style={styles.coverTag}>
                  <Txt size={9} color={C.white}>
                    {t('대표', 'COVER', 'カバー')}
                  </Txt>
                </View>
              )}
              <Pressable onPress={() => remove(p.key)} style={styles.remove} hitSlop={6} accessibilityLabel={t('사진 삭제', 'Remove photo', '写真を削除')} testID={testID ? `${testID}-remove` : undefined}>
                <Txt size={12} color={C.white} weight="bold">
                  ×
                </Txt>
              </Pressable>
            </View>
          );
        })}
        {!photos.length && (
          <View style={[styles.thumb, styles.empty]}>
            <Txt size={11} color={C.muted}>
              {t('사진 없음', 'No photo', '写真なし')}
            </Txt>
          </View>
        )}
      </View>
      <Txt size={10} color={C.muted} style={{ marginTop: 6, lineHeight: 15 }}>
        {note ?? t('첫 사진이 대표 사진입니다. 사진을 누르면 대표로 바뀝니다. 위치 정보(GPS)는 저장하지 않습니다.', 'The first photo is the cover; tap a photo to make it the cover. Location data (GPS) is never kept.', '最初の写真がカバーです。写真をタップするとカバーになります。位置情報（GPS）は保存しません。')}
      </Txt>
    </View>
  );
}

/** Swipeable photos with an "n/m" counter. */
export function PhotoPager({ uris, aspect = 4 / 5, testID }: { uris: string[]; aspect?: number; testID?: string }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 720);
  const [index, setIndex] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, w)));
  if (!uris.length) return null;
  return (
    <View style={{ width: w, alignSelf: 'center', marginBottom: 18 }} testID={testID}>
      <FlatList
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u, i) => `${i}:${u}`}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
        renderItem={({ item }) => (
          <View style={{ width: w, aspectRatio: aspect, backgroundColor: '#EDEDED' }}>
            {item ? <Image source={{ uri: item }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} /> : null}
          </View>
        )}
      />
      {uris.length > 1 && (
        <Txt size={11} color={C.sub} style={{ position: 'absolute', right: 12, bottom: 10, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 7, paddingVertical: 3 }} testID={testID ? `${testID}-count` : undefined}>
          {`${index + 1}/${uris.length}`}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  thumb: { width: 76, height: 76, backgroundColor: '#E6E6E6', overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9C9C9', backgroundColor: 'transparent' },
  coverTag: { position: 'absolute', left: 0, top: 0, backgroundColor: C.ink, paddingHorizontal: 4, paddingVertical: 1 },
  remove: { position: 'absolute', right: 0, top: 0, width: 20, height: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});
