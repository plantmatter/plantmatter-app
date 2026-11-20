// Line icons drawn like the plantmatter.kr icons: a 24 × 24 grid, 1.5 stroke, round ends, no fill.
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { C } from '@/lib/theme';

type P = { size?: number; color?: string; weight?: number; style?: ViewStyle };

/** One 24-grid line drawing. */
function Line({ size = 24, color = C.ink, weight = 1.5, style, children }: P & { children: ReactNode }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinejoin="round" strokeLinecap="round">
        {children}
      </Svg>
    </View>
  );
}

export const ChevronLeft = (p: P) => (
  <Line {...p}>
    <Path d="M15 4.5 7.5 12l7.5 7.5" />
  </Line>
);
export const ChevronRight = ({ color = C.muted, size = 16, ...p }: P) => (
  <Line color={color} size={size} {...p}>
    <Path d="M9 4.5 16.5 12 9 19.5" />
  </Line>
);
export const Plus = (p: P) => (
  <Line {...p}>
    <Path d="M12 4.5v15M4.5 12h15" />
  </Line>
);
export const Menu = (p: P) => (
  <Line {...p}>
    <Path d="M4 7h16M4 12h16M4 17h16" />
  </Line>
);
/** ∨ / ^ for "show more" toggles. */
export const ChevronDown = ({ up = false, ...p }: P & { up?: boolean }) => (
  <Line {...p}>
    <Path d={up ? 'M5 15.5 12 8.5l7 7' : 'M5 8.5 12 15.5l7-7'} />
  </Line>
);
/** The magnifier of plantmatter.kr (same drawing: circle r 6.5 and a 5-unit handle). */
export const SearchIcon = (p: P) => (
  <Line {...p}>
    <Circle cx="10.5" cy="10.5" r="6.5" />
    <Path d="m15.5 15.5 5 5" />
  </Line>
);
/** ↓↑ sort, drawn in the same 15 × 15 square as ＋ (two arrows set apart, not a tall narrow mark). */
export const SortIcon = (p: P) => (
  <Line {...p}>
    <Path d="M8 4.5v15M4.5 16 8 19.5l3.5-3.5M16 19.5v-15M12.5 8 16 4.5 19.5 8" />
  </Line>
);
/** ⋯ more actions. */
export const MoreIcon = (p: P) => (
  <Line weight={2.4} {...p}>
    <Path d="M5.5 12h.01M12 12h.01M18.5 12h.01" />
  </Line>
);
/** ≡ handle for dragging a row. */
export const DragHandle = ({ color = C.muted, ...p }: P) => (
  <Line color={color} {...p}>
    <Path d="M5 9h14M5 12h14M5 15h14" />
  </Line>
);
/** Selection mark in edit mode: an open circle, filled with a tick when chosen. */
export function CheckMark({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <Circle cx="12" cy="12" r="9.5" stroke={on ? C.ink : '#A8A8A8'} strokeWidth={1.5} fill={on ? C.ink : 'none'} />
        {on && <Path d="m7.8 12.3 2.8 2.8 5.6-5.8" stroke={C.white} strokeWidth={1.7} />}
      </Svg>
    </View>
  );
}

/** → in a filled circle (event rows). */
export function GoArrow({ size = 40, ring = C.ink, color = C.lime }: { size?: number; ring?: string; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ring, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
        <Path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
      </Svg>
    </View>
  );
}
