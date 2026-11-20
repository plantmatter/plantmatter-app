import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { moveItem } from '@/lib/reorder';
import { C } from '@/lib/theme';

import { DragHandle } from './icons';
import { useScrollLock } from './ui';

type Drag = { key: string; from: number; over: number };
/** The order shown since a drop, kept until the list given by the parent catches up (or the save fails). */
type Dropped = { before: string; after: string[] };

/**
 * A list whose rows are dragged by their ≡ handle (EDIT mode). Rows have one fixed height and are placed
 * absolutely, so the dragged row keeps its touch while the others make room.
 *
 * On release the new order is shown at once — the row settles into the slot where it was dropped and never
 * goes back first — and `onReorder` saves it. The list keeps showing that order until `items` arrives in it;
 * if `onReorder` resolves to false (the save failed) the old order comes back.
 */
export function ReorderList<T>({ items, keyOf, rowHeight, renderRow, onReorder, testID }: { items: T[]; keyOf: (item: T) => string; rowHeight: number; renderRow: (item: T, handle: ReactNode) => ReactNode; onReorder: (next: T[]) => Promise<boolean> | void; testID?: string }) {
  const lockScroll = useScrollLock();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const dy = useSharedValue(0);

  const itemsKeys = items.map(keyOf).join('|');
  // The parent caught up (or the list changed in another way): show its order again.
  if (dropped && itemsKeys !== dropped.before) setDropped(null);
  const byKey = new Map(items.map((i) => [keyOf(i), i]));
  const shown = dropped && itemsKeys === dropped.before ? dropped.after.map((k) => byKey.get(k)!).filter(Boolean) : items;

  const start = (key: string) => {
    const from = shown.findIndex((i) => keyOf(i) === key);
    if (from < 0) return;
    dy.set(0);
    dragRef.current = { key, from, over: from };
    setDrag(dragRef.current);
    lockScroll(true);
  };
  const move = (y: number) => {
    const d = dragRef.current;
    if (!d) return;
    dy.set(y);
    const over = Math.max(0, Math.min(shown.length - 1, Math.round(d.from + y / rowHeight)));
    if (over !== d.over) {
      dragRef.current = { ...d, over };
      setDrag(dragRef.current);
    }
  };
  const end = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDrag(null);
    lockScroll(false);
    if (d.over === d.from) return;
    const next = moveItem(shown, d.from, d.over);
    setDropped({ before: itemsKeys, after: next.map(keyOf) });
    Promise.resolve(onReorder(next)).then((ok) => {
      if (ok === false) setDropped(null);
    });
  };

  const order = drag ? moveItem(shown, drag.from, drag.over) : shown;
  return (
    <View style={{ height: shown.length * rowHeight }} testID={testID}>
      {shown.map((item, i) => {
        const key = keyOf(item);
        return (
          <Row key={key} slot={order.indexOf(item)} start={i} rowHeight={rowHeight} dragging={drag?.key === key} dy={dy} onStart={() => start(key)} onMove={move} onEnd={end} render={(handle) => renderRow(item, handle)} testID={testID ? `${testID}-handle-${key}` : undefined} />
        );
      })}
    </View>
  );
}

function Row({ slot, start, rowHeight, dragging, dy, onStart, onMove, onEnd, render, testID }: { slot: number; start: number; rowHeight: number; dragging: boolean; dy: SharedValue<number>; onStart: () => void; onMove: (y: number) => void; onEnd: () => void; render: (handle: ReactNode) => ReactNode; testID?: string }) {
  // Created once; calls the latest handlers, so re-renders during a drag never rebuild it.
  const latest = useRef({ onStart, onMove, onEnd });
  useEffect(() => {
    latest.current = { onStart, onMove, onEnd };
  });
  const pan = usePanGesture({
    runOnJS: true,
    onActivate: () => latest.current.onStart(),
    onUpdate: (e) => latest.current.onMove(e.translationY),
    onFinalize: () => latest.current.onEnd(),
  });
  // Dragged: follows the finger. Otherwise: slides to its slot — for the row just dropped, a short settle from
  // where the finger left it into the new slot.
  const style = useAnimatedStyle(() =>
    dragging
      ? { zIndex: 10, transform: [{ translateY: start * rowHeight + dy.get() }], backgroundColor: C.white, opacity: 0.96 }
      : { zIndex: 0, transform: [{ translateY: withTiming(slot * rowHeight, { duration: 140 }) }], backgroundColor: 'transparent', opacity: 1 },
  );
  const handle = (
    <GestureDetector gesture={pan}>
      <View style={{ width: 44, height: rowHeight, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="adjustable" testID={testID}>
        <View style={{ pointerEvents: 'none' }}>
          <DragHandle size={24} />
        </View>
      </View>
    </GestureDetector>
  );
  return <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: rowHeight }, style]}>{render(handle)}</Animated.View>;
}
