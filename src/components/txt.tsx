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

// Advance widths of Figtree Bold for ASCII 32…126, in hundredths of an em (from the font file).
const BOLD_WIDTHS = '24,31,41,63,55,81,65,24,38,38,49,63,26,41,25,43,65,42,58,56,63,58,58,56,61,58,30,30,63,63,63,51,99,71,61,72,70,59,55,74,75,29,55,67,54,86,77,79,60,79,64,61,58,70,72,98,68,65,63,34,43,34,58,43,26,53,60,55,60,55,39,60,57,26,29,54,25,87,57,58,60,59,38,47,40,57,56,84,54,58,48,39,26,39,67'.split(',').map(Number);
/**
 * About how wide a bold title is, in px: Figtree Bold widths for Latin, 0.92 em for Hangul (Noto Sans KR Bold),
 * 1 em for Japanese; `letterSpacing` is added per character. Used to fit a title on one line.
 */
export function boldTextWidth(text: string, size: number, letterSpacing = 0) {
  let em = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    em += c >= 32 && c <= 126 ? BOLD_WIDTHS[c - 32] / 100 : HANGUL.test(ch) ? 0.92 : KANA_HAN.test(ch) ? 1 : 0.6;
  }
  return em * size + letterSpacing * [...text].length;
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
