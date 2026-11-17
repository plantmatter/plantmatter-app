// Simple line icons drawn with views (no icon font or SVG library needed).
import { View, type ViewStyle } from 'react-native';

import { C } from '@/lib/theme';

type P = { size?: number; color?: string; weight?: number; style?: ViewStyle };

export function ChevronLeft({ size = 22, color = C.ink, weight = 2.4, style }: P) {
  const s = size * 0.55;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ width: s, height: s, borderLeftWidth: weight, borderBottomWidth: weight, borderColor: color, transform: [{ translateX: s * 0.2 }, { rotate: '45deg' }] }} />
    </View>
  );
}
export function ChevronRight({ size = 16, color = C.muted, weight = 1.6, style }: P) {
  const s = size * 0.5;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ width: s, height: s, borderRightWidth: weight, borderTopWidth: weight, borderColor: color, transform: [{ translateX: -s * 0.2 }, { rotate: '45deg' }] }} />
    </View>
  );
}
export function Plus({ size = 24, color = C.ink, weight = 2.2, style }: P) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ position: 'absolute', width: size * 0.8, height: weight, backgroundColor: color, borderRadius: weight }} />
      <View style={{ position: 'absolute', width: weight, height: size * 0.8, backgroundColor: color, borderRadius: weight }} />
    </View>
  );
}
export function Menu({ size = 24, color = C.ink, weight = 2.6, style }: P) {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', gap: size * 0.2 }, style]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: weight, backgroundColor: color, borderRadius: weight }} />
      ))}
    </View>
  );
}
/** → in a filled circle (event rows). */
export function GoArrow({ size = 40, ring = C.ink, color = C.lime }: { size?: number; ring?: string; color?: string }) {
  const line = size * 0.42;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ring, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: line, height: 2.2, backgroundColor: color, borderRadius: 2 }} />
      <View
        style={{
          position: 'absolute',
          right: size / 2 - line / 2,
          width: size * 0.22,
          height: size * 0.22,
          borderRightWidth: 2.2,
          borderTopWidth: 2.2,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
