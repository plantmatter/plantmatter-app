import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { C } from '@/lib/theme';

import { ChevronRight, Plus } from './icons';
import { Txt } from './txt';

/** Plant / find row with a square thumbnail, italic name and a small meta line. */
/**
 * `name` is a string (italic, or bold upright with `strong`) or an already typeset name (observations).
 * `strong`: the roomier My Plants list row — bold name, bigger ›, light lines.
 */
/** `tag`: a short note before the › (e.g. watering "D-2"); `strong` tags are lime, like the watering button. */
export function ItemRow({ name, meta, thumb, onPress, badge, strong, tag, testID }: { name: ReactNode; meta?: string; thumb?: string; onPress: () => void; badge?: string; strong?: boolean; tag?: { label: string; strong: boolean } | null; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, strong && styles.rowStrong, pressed && { opacity: 0.6 }]} accessibilityRole="button" testID={testID}>
      <View style={[styles.thumb, strong && styles.thumbStrong]}>{thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt size={18} color="#BBB">✿</Txt>}</View>
      <View style={{ flex: 1 }}>
        {typeof name === 'string' ? (
          strong ? (
            <Txt weight="bold" size={16} numberOfLines={2} style={{ lineHeight: 21 }}>
              {name}
            </Txt>
          ) : (
            <Txt italic size={15} numberOfLines={2}>
              {name}
            </Txt>
          )
        ) : (
          name
        )}
        {(!!meta || !!badge) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            {!!badge && (
              <View style={styles.badge}>
                <Txt size={9} color={C.white}>
                  {badge}
                </Txt>
              </View>
            )}
            {!!meta && (
              <Txt size={11} color={C.muted} style={{ flexShrink: 1 }}>
                {meta}
              </Txt>
            )}
          </View>
        )}
      </View>
      {!!tag && (
        <View style={[styles.tag, tag.strong && styles.tagStrong]} testID={testID ? `${testID}-tag` : undefined}>
          <Txt size={11} weight={tag.strong ? 'bold' : 'light'} color={tag.strong ? C.ink : C.muted}>
            {tag.label}
          </Txt>
        </View>
      )}
      {strong ? <ChevronRight size={24} color={C.ink} /> : <ChevronRight />}
    </Pressable>
  );
}

/** Medium row inside an open category (sub-category, country). */
export function SubRow({ title, count, empty, open, onPress, testID }: { title: string; count: number; empty?: boolean; open?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ paddingVertical: 7 }, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityState={{ expanded: open }} testID={testID}>
      <Txt weight="bold" size={19} color={empty ? '#C2C2C2' : C.ink}>
        {title}
        <Txt size={11} color={C.muted}>{`  (${count})`}</Txt>
      </Txt>
    </Pressable>
  );
}

/** Indented block with a dark left rule (open category / region). */
export function Nest({ children, light }: { children: ReactNode; light?: boolean }) {
  return <View style={[styles.nest, light && styles.nestLight]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#E1E1E1' },
  rowStrong: { paddingVertical: 14, gap: 14, borderBottomColor: C.hair },
  thumb: { width: 48, height: 48, backgroundColor: '#E9E9E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbStrong: { width: 52, height: 52 },
  badge: { backgroundColor: '#6B6B6B', paddingHorizontal: 5, paddingVertical: 1 },
  tag: { paddingHorizontal: 2, paddingVertical: 2 },
  tagStrong: { backgroundColor: C.lime, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  nest: { marginLeft: 2, marginTop: 4, marginBottom: 14, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: C.hair },
  nestLight: { borderLeftWidth: 1, borderLeftColor: C.hair, marginBottom: 8, paddingLeft: 12 },
});

/** A plain ＋ button (adds a plant). */
export function PlusButton({ onPress, label, size = 44, testID }: { onPress: () => void; label: string; size?: number; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} testID={testID}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#BDBDBD', backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Plus size={size * 0.5} />
    </Pressable>
  );
}

/** Small underlined text action ("이름 변경"). */
export function TextAction({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" testID={testID}>
      <Txt size={12} color={C.sub} style={{ textDecorationLine: 'underline' }}>
        {label}
      </Txt>
    </Pressable>
  );
}
