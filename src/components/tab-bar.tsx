import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, TAB_HEIGHT } from '@/lib/theme';

import { Txt } from './txt';

const LABELS: Record<string, string> = { index: 'HOME', plant: 'PLANT', matter: 'MATTER', options: 'OPTION' };

/** Text-only tabs: HOME · PLANT · MATTER · OPTION. Tapping the open tab goes back to its first screen. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_HEIGHT + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const label = LABELS[route.name];
        if (!label) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            testID={`tab-${route.name}`}>
            <Txt size={12} color={focused ? C.ink : C.muted} weight={focused ? 'bold' : 'light'} style={styles.label}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.nav, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCDCDC' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { letterSpacing: 2.4 },
});
