import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { moveItem } from '@/lib/reorder';
import { C } from '@/lib/theme';

import { DragHandle } from './icons';
import { useScrollLock } from './ui';

type Drag = { key: string; from: number; over: number };

/**
 * A list whose rows are dragged by their ≡ handle (EDIT mode). Rows have one fixed height and are placed
 * absolutely, so the dragged row keeps its touch while the others make room; `onReorder` gets the new order.
 */
export function ReorderList<T>({ items, keyOf, rowHeight, renderRow, onReorder, testID }: { items: T[]; keyOf: (item: T) => string; rowHeight: number; renderRow: (item: T, handle: ReactNode) => ReactNode; onReorder: (next: T[]) => void; testID?: string }) {
  const lockScroll = useScrollLock();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const dy = useSharedValue(0);

  const start = (key: string) => {
    const from = items.findIndex((i) => keyOf(i) === key);
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
    const over = Math.max(0, Math.min(items.length - 1, Math.round(d.from + y / rowHeight)));
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
    if (d.over !== d.from) onReorder(moveItem(items, d.from, d.over));
  };

  const order = drag ? moveItem(items, drag.from, drag.over) : items;
  return (
    <View style={{ height: items.length * rowHeight }} testID={testID}>
      {items.map((item, i) => {
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
  const style = useAnimatedStyle(() =>
    dragging
      ? { zIndex: 10, transform: [{ translateY: start * rowHeight + dy.get() }], backgroundColor: C.white, opacity: 0.96 }
      : { zIndex: 0, transform: [{ translateY: withTiming(slot * rowHeight, { duration: 160 }) }], backgroundColor: 'transparent', opacity: 1 },
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
