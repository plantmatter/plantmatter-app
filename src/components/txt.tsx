import { Children, isValidElement, type ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { C, F } from '@/lib/theme';

export type Weight = 'light' | 'bold' | 'black';
type Props = TextProps & { weight?: Weight; italic?: boolean; size?: number; color?: string };

const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/;
const KANA_HAN = /[぀-ヿㇰ-ㇿ㐀-鿿豈-﫿]/;

const textOf = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return Children.toArray(node).map(textOf).join('');
};

/**
 * Latin letters and digits in Figtree, Korean in Noto Sans KR (Light 300 / Bold 700, big numbers ExtraBold 800).
 * React Native has no font fallback list, so the family is chosen from the text itself:
 * Hangul → Noto Sans KR (it also covers Latin), Japanese kana/kanji → the system Japanese font, otherwise Figtree.
 */
export function fontFor(text: string, weight: Weight = 'light', italic = false): TextStyle {
  if (HANGUL.test(text)) return { fontFamily: weight === 'light' ? F.koLight : F.koBold };
  if (KANA_HAN.test(text)) return Platform.select<TextStyle>({ web: { fontWeight: weight === 'light' ? '300' : '700' }, default: { fontWeight: weight === 'light' ? '300' : '700' } });
  if (italic && weight === 'light') return { fontFamily: F.latinLightItalic };
  return { fontFamily: weight === 'light' ? F.latinLight : weight === 'bold' ? F.latinBold : F.latinBlack, fontStyle: italic ? 'italic' : 'normal' };
}

/**
 * Distance from the bottom of a one-line text box to the letters' baseline, from each font's ascent / descent
 * (Figtree 0.95 / 0.25 em, Noto Sans KR 1.16 / 0.288 em, Japanese system font about 0.88 / 0.12 em).
 * Used to sit icons and small counts on the same line as a big title.
 */
export function baselineFromBottom(text: string, size: number, lineHeight = size * 1.2) {
  const [a, d] = HANGUL.test(text) ? [1.16, 0.288] : KANA_HAN.test(text) ? [0.88, 0.12] : [0.95, 0.25];
  return (lineHeight - (a + d) * size) / 2 + d * size;
}

export function Txt({ weight = 'light', italic = false, size, color, style, children, ...rest }: Props) {
  const font = fontFor(textOf(children), weight, italic);
  return (
    <Text {...rest} style={[{ color: color ?? C.ink, fontSize: size ?? 14 }, font, style]}>
      {children}
    </Text>
  );
}
