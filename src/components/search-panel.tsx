import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { SearchIcon } from './icons';
import { fontFor, Txt } from './txt';

// The plantmatter.kr search motion: the panel comes down in 0.75 s on (.22, 1, .36, 1) and goes up in 0.45 s on
// (.55, 0, .45, 1); its contents fade in 0.22 s later; the page behind dims to 18 % ink.
const OPEN = Easing.bezier(0.22, 1, 0.36, 1);
const CLOSE = Easing.bezier(0.55, 0, 0.45, 1);
const PANEL = 104;

/**
 * Search panel that slides down from under the top bar. While nothing is typed the page behind is dimmed;
 * once a word is typed the dim clears so the filtered list shows. CLOSE (or a tap on the dim) clears it.
 */
export function SearchPanel({ open, value, onChange, onClose, placeholder, testID }: { open: boolean; value: string; onChange: (v: string) => void; onClose: () => void; placeholder: string; testID?: string }) {
  const { t } = useLocale();
  const [shown, setShown] = useState(open);
  const [y] = useState(() => new Animated.Value(-PANEL));
  const [inner] = useState(() => new Animated.Value(0));
  const [dim] = useState(() => new Animated.Value(0));
  const input = useRef<TextInputInstance>(null);
  if (open && !shown) setShown(true);

  useEffect(() => {
    if (open) {
      inner.setValue(0);
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 750, easing: OPEN, useNativeDriver: false }),
        Animated.timing(inner, { toValue: 1, duration: 500, delay: 220, easing: OPEN, useNativeDriver: false }),
      ]).start();
      const id = setTimeout(() => input.current?.focus(), 260);
      return () => clearTimeout(id);
    }
    Animated.parallel([
      Animated.timing(y, { toValue: -PANEL, duration: 450, easing: CLOSE, useNativeDriver: false }),
      Animated.timing(inner, { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(dim, { toValue: 0, duration: 450, easing: CLOSE, useNativeDriver: false }),
    ]).start(({ finished }) => finished && setShown(false));
  }, [open, y, inner, dim]);

  useEffect(() => {
    if (!open) return;
    Animated.timing(dim, { toValue: value ? 0 : 1, duration: value ? 250 : 750, easing: OPEN, useNativeDriver: false }).start();
  }, [open, value, dim]);

  if (!shown) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,23,23,0.18)', opacity: dim }]} pointerEvents={value ? 'none' : 'auto'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('검색 닫기', 'Close search', '検索を閉じる')} />
      </Animated.View>
      <Animated.View style={[styles.panel, { transform: [{ translateY: y }] }]}>
        <Animated.View style={{ opacity: inner, transform: [{ translateY: inner.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
          <View style={styles.row}>
            <TextInput
              ref={input}
              value={value}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor="#BBBBBB"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={placeholder}
              style={[styles.input, fontFor(value || placeholder)]}
              testID={testID ? `${testID}-input` : undefined}
            />
            <SearchIcon />
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={{ alignSelf: 'flex-end', marginTop: 10 }} accessibilityRole="button" testID={testID ? `${testID}-close` : undefined}>
            <Txt size={12} style={{ letterSpacing: 1.6 }}>
              CLOSE
            </Txt>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, top: 0, height: PANEL, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 22, paddingTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.ink },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 0, color: C.ink, outlineWidth: 0 },
});
