import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { chooseAsync, notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { pickPhotos, type FormPhoto } from '@/lib/photos';
import { moveItem, slotAt, slotXY } from '@/lib/reorder';
import { C } from '@/lib/theme';

import { Plus } from './icons';
import { Txt } from './txt';
import { Label, useScrollLock } from './ui';

const TILE = 76;
const GAP = 8;
const STEP = TILE + GAP;
type Drag = { key: string; from: number; over: number };

/**
 * Photo grid in forms. The ＋ tile asks album or camera; long-press a photo and drag it to change the order
 * (the first photo is the cover); × removes. `resolve` turns a stored path into a displayable URL.
 * Tiles are placed absolutely and never re-ordered in the view tree, so the dragged view keeps its touch.
 */
export function PhotoField({ label, photos, onChange, max, resolve, maxSide = 1600, note, testID }: { label: string; photos: FormPhoto[]; onChange: (p: FormPhoto[]) => void; max: number; resolve: (path: string) => string; maxSide?: number; note?: string; testID?: string }) {
  const { t } = useLocale();
  const lockScroll = useScrollLock();
  const [busy, setBusy] = useState(false);
  const [cols, setCols] = useState(4);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const left = max - photos.length;

  const add = async () => {
    if (left <= 0 || busy) return;
    const choice = await chooseAsync([t('앨범에서 선택', 'Choose from album', 'アルバムから選択'), t('사진 촬영', 'Take photo', '写真を撮る')], t('취소', 'Cancel', 'キャンセル'));
    if (choice < 0) return;
    setBusy(true);
    try {
      const picked = await pickPhotos(choice === 1 ? 'camera' : 'library', left, maxSide);
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

  const startDrag = (key: string) => {
    const from = photos.findIndex((p) => p.key === key);
    if (from < 0 || photos.length < 2) return;
    tx.set(0);
    ty.set(0);
    dragRef.current = { key, from, over: from };
    setDrag(dragRef.current);
    lockScroll(true);
  };
  const moveDrag = (dx: number, dy: number) => {
    const d = dragRef.current;
    if (!d) return;
    tx.set(dx);
    ty.set(dy);
    const over = slotAt(d.from, dx, dy, cols, STEP, photos.length);
    if (over !== d.over) {
      dragRef.current = { ...d, over };
      setDrag(dragRef.current);
    }
  };
  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDrag(null);
    lockScroll(false);
    if (d.over !== d.from) onChange(moveItem(photos, d.from, d.over));
  };

  // Where each photo sits right now (while dragging, the others make room).
  const order = drag ? moveItem(photos, drag.from, drag.over) : photos;
  const tiles = photos.length + (left > 0 ? 1 : 0);
  const rows = Math.max(1, Math.ceil(tiles / cols));
  const addSlot = slotXY(photos.length, cols, STEP);

  return (
    <View style={{ marginBottom: 18 }} testID={testID}>
      <Label>{`${label} (${photos.length}/${max})`}</Label>
      <View
        style={{ height: rows * STEP - GAP, marginTop: 4 }}
        onLayout={(e) => setCols(Math.max(1, Math.floor((e.nativeEvent.layout.width + GAP) / STEP)))}
        testID={testID ? `${testID}-grid` : undefined}>
        {photos.map((p, i) => {
          const src = p.uri ?? (p.path ? resolve(p.path) : '');
          const at = order.indexOf(p);
          return (
            <PhotoTile
              key={p.key}
              src={src}
              cover={at === 0}
              slot={slotXY(at, cols, STEP)}
              start={slotXY(i, cols, STEP)}
              dragging={drag?.key === p.key}
              tx={tx}
              ty={ty}
              onStart={() => startDrag(p.key)}
              onMove={moveDrag}
              onEnd={endDrag}
              onRemove={() => remove(p.key)}
              testID={testID}
            />
          );
        })}
        {left > 0 && (
          <Pressable
            onPress={add}
            disabled={busy}
            style={({ pressed }) => [styles.thumb, styles.addTile, { transform: [{ translateX: addSlot.x }, { translateY: addSlot.y }] }, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={t('사진 추가', 'Add photos', '写真を追加')}
            testID={testID ? `${testID}-add` : undefined}>
            {busy ? <ActivityIndicator color={C.muted} /> : <Plus size={26} weight={1.5} color="#8A8A8A" />}
          </Pressable>
        )}
      </View>
      <Txt size={10} color={C.muted} style={{ marginTop: 6, lineHeight: 15 }}>
        {[
          photos.length > 1 ? t('사진을 길게 눌러 끌면 순서가 바뀝니다.', 'Long-press a photo and drag it to change the order.', '写真を長押ししてドラッグすると順番が変わります。') : '',
          note ?? t('첫 사진이 대표 사진입니다. 사진 속 위치 정보(GPS)는 지우고 올립니다.', 'The first photo is the cover. Location data inside photos is removed before upload.', '最初の写真がカバーです。写真内の位置情報は削除してからアップロードします。'),
        ]
          .filter(Boolean)
          .join(' ')}
      </Txt>
    </View>
  );
}

function PhotoTile({ src, cover, slot, start, dragging, tx, ty, onStart, onMove, onEnd, onRemove, testID }: {
  src: string;
  cover: boolean;
  slot: { x: number; y: number };
  start: { x: number; y: number };
  dragging: boolean;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: () => void;
  onRemove: () => void;
  testID?: string;
}) {
  const { t } = useLocale();
  // The gesture is created once; it calls the latest handlers through a ref, so re-renders during a drag
  // (the other photos making room) never rebuild it and cancel the drag.
  const latest = useRef({ onStart, onMove, onEnd });
  useEffect(() => {
    latest.current = { onStart, onMove, onEnd };
  });
  const pan = usePanGesture({
    activateAfterLongPress: 250,
    runOnJS: true,
    onActivate: () => latest.current.onStart(),
    onUpdate: (e) => latest.current.onMove(e.translationX, e.translationY),
    onFinalize: () => latest.current.onEnd(),
  });
  const moved = useAnimatedStyle(() =>
    dragging
      ? { zIndex: 10, opacity: 0.9, transform: [{ translateX: start.x + tx.get() }, { translateY: start.y + ty.get() }, { scale: 1.06 }] }
      : { zIndex: 0, opacity: 1, transform: [{ translateX: withTiming(slot.x, { duration: 160 }) }, { translateY: withTiming(slot.y, { duration: 160 }) }, { scale: withTiming(1, { duration: 120 }) }] },
  );
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.thumb, styles.placed, moved]} testID={testID ? `${testID}-thumb` : undefined}>
        {/* The picture itself takes no touches: the tile handles them (and browsers cannot start an image drag). */}
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>{src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
        {cover && (
          <View style={styles.coverTag} testID={testID ? `${testID}-cover` : undefined}>
            <Txt size={9} color={C.white}>
              {t('대표', 'COVER', 'カバー')}
            </Txt>
          </View>
        )}
        <Pressable onPress={onRemove} style={styles.remove} hitSlop={6} accessibilityLabel={t('사진 삭제', 'Remove photo', '写真を削除')} testID={testID ? `${testID}-remove` : undefined}>
          <Txt size={12} color={C.white} weight="bold">
            ×
          </Txt>
        </Pressable>
      </Animated.View>
    </GestureDetector>
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
  thumb: { width: TILE, height: TILE, backgroundColor: '#E6E6E6', overflow: 'hidden' },
  placed: { position: 'absolute', left: 0, top: 0 },
  addTile: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9C9C9', backgroundColor: 'transparent' },
  coverTag: { position: 'absolute', left: 0, top: 0, backgroundColor: C.ink, paddingHorizontal: 4, paddingVertical: 1 },
  remove: { position: 'absolute', right: 0, top: 0, width: 20, height: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});
