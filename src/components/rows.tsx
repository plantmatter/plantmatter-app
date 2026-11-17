import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { C } from '@/lib/theme';

import { ChevronRight } from './icons';
import { Txt } from './txt';

/** Plant / find row with a square thumbnail, italic name and a small meta line. */
export function ItemRow({ name, meta, thumb, onPress, badge, testID }: { name: string; meta?: string; thumb?: string; onPress: () => void; badge?: string; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" testID={testID}>
      <View style={styles.thumb}>{thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt size={18} color="#BBB">✿</Txt>}</View>
      <View style={{ flex: 1 }}>
        <Txt italic size={15} numberOfLines={2}>
          {name}
        </Txt>
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
      <ChevronRight />
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

export function ActionChips({ actions }: { actions: { label: string; onPress: () => void; primary?: boolean; testID?: string }[] }) {
  return (
    <View style={styles.chips}>
      {actions.map((a) => (
        <Pressable key={a.label} onPress={a.onPress} style={[styles.chip, a.primary && styles.chipPrimary]} accessibilityRole="button" testID={a.testID}>
          <Txt size={11} color={a.primary ? C.white : C.ink}>
            {a.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#E1E1E1' },
  thumb: { width: 48, height: 48, backgroundColor: '#E9E9E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: '#6B6B6B', paddingHorizontal: 5, paddingVertical: 1 },
  nest: { marginLeft: 2, marginTop: 4, marginBottom: 14, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: C.ink },
  nestLight: { borderLeftWidth: 1, borderLeftColor: '#BDBDBD', marginBottom: 8, paddingLeft: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: '#C9C9C9', backgroundColor: C.white, paddingHorizontal: 10, minHeight: 32, justifyContent: 'center' },
  chipPrimary: { backgroundColor: C.ink, borderColor: C.ink },
});
