import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { SearchIcon } from './icons';
import { fontFor, Txt } from './txt';

// The plantmatter.kr search motion: the panel comes down in 0.75 s on (.22, 1, .36, 1) and goes up in 0.45 s on
// (.55, 0, .45, 1); its contents fade in from 0.22 s; the page behind dims to 18 % ink.
// Everything runs on the UI thread (Reanimated), so the keyboard coming up or the list filtering never makes
// the motion stutter, and the panel, its contents and the dim all come to rest at the same moment.
const OPEN = Easing.bezier(0.22, 1, 0.36, 1);
const CLOSE = Easing.bezier(0.55, 0, 0.45, 1);
const OPEN_MS = 750;
const CLOSE_MS = 450;
const INNER_DELAY = 220;
/** The keyboard is called once the panel is nearly down (about 97 % of the way). */
const KEYBOARD_AT = 520;
const PANEL = 104;

/**
 * Search panel that slides down from under the top bar. While nothing is typed the page behind is dimmed;
 * once a word is typed the dim clears so the filtered list shows. CLOSE (or a tap on the dim) clears it.
 */
export function SearchPanel({ open, value, onChange, onClose, placeholder, testID }: { open: boolean; value: string; onChange: (v: string) => void; onClose: () => void; placeholder: string; testID?: string }) {
  const { t } = useLocale();
  const [shown, setShown] = useState(open);
  const input = useRef<TextInputInstance>(null);
  const wasOpen = useRef(false);
  const y = useSharedValue(-PANEL);
  const inner = useSharedValue(0);
  const dim = useSharedValue(0);
  if (open && !shown) setShown(true);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      inner.set(0);
      y.set(withTiming(0, { duration: OPEN_MS, easing: OPEN }));
      inner.set(withDelay(INNER_DELAY, withTiming(1, { duration: OPEN_MS - INNER_DELAY, easing: OPEN })));
      const id = setTimeout(() => input.current?.focus(), KEYBOARD_AT);
      return () => clearTimeout(id);
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    Keyboard.dismiss();
    inner.set(withTiming(0, { duration: 180 }));
    dim.set(withTiming(0, { duration: CLOSE_MS, easing: CLOSE }));
    y.set(
      withTiming(-PANEL, { duration: CLOSE_MS, easing: CLOSE }, (finished) => {
        if (finished) scheduleOnRN(setShown, false);
      }),
    );
  }, [open, y, inner, dim]);

  // Dim while the box is empty; clear it as soon as something is typed. Opening, it settles with the panel.
  useEffect(() => {
    if (!open) return;
    dim.set(withTiming(value ? 0 : 1, { duration: value ? 250 : OPEN_MS, easing: OPEN }));
  }, [open, value, dim]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const innerStyle = useAnimatedStyle(() => ({ opacity: inner.get(), transform: [{ translateY: (1 - inner.get()) * -6 }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));

  if (!shown) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,23,23,0.18)', pointerEvents: value ? 'none' : 'auto' }, dimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('검색 닫기', 'Close search', '検索を閉じる')} />
      </Animated.View>
      <Animated.View style={[styles.panel, panelStyle]}>
        <Animated.View style={innerStyle}>
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
