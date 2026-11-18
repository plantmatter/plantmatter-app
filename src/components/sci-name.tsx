import type { ReactNode } from 'react';
import { View, type TextStyle } from 'react-native';

import { useLocale } from '@/lib/i18n';
import { displayName, findNamePieces, piecesOfName, UNIDENTIFIED, type NamePiece, type Qualifier } from '@/lib/names';
import { C } from '@/lib/theme';

import { Txt } from './txt';

/** A name typeset in pieces (italic / upright). */
export function SciName({ pieces, size = 15, style, numberOfLines, testID }: { pieces: NamePiece[]; size?: number; style?: TextStyle; numberOfLines?: number; testID?: string }) {
  return (
    <Txt size={size} style={style} numberOfLines={numberOfLines} testID={testID}>
      {pieces.map((p, i) => (
        <Txt key={i} size={size} italic={p.italic}>
          {(i ? ' ' : '') + p.text}
        </Txt>
      ))}
    </Txt>
  );
}

type FindLike = { scientific_name: string; genus?: string | null; qualifier?: Qualifier | null; species?: string | null; authority?: string | null; cultivar?: string | null };
/** Pieces for an observation: from its parts, or from the stored text for older records; "이름 모름" when unknown. */
export function useFindPieces(f: FindLike): NamePiece[] {
  const { locale } = useLocale();
  const fromParts = findNamePieces(f);
  if (fromParts.length) return fromParts;
  if (!f.scientific_name || f.scientific_name === UNIDENTIFIED) return [{ text: displayName(f.scientific_name, locale), italic: false }];
  return piecesOfName(f.scientific_name);
}

export function FindName({ find, size, style, numberOfLines, testID }: { find: FindLike; size?: number; style?: TextStyle; numberOfLines?: number; testID?: string }) {
  return <SciName pieces={useFindPieces(find)} size={size} style={style} numberOfLines={numberOfLines} testID={testID} />;
}

/** "저장될 이름" shown as plain text under the name boxes (it cannot be typed into). */
export function NamePreview({ children, empty, testID }: { children: ReactNode; empty?: string; testID?: string }) {
  const { t } = useLocale();
  return (
    <View style={{ marginTop: -2, marginBottom: 18 }} testID={testID}>
      <Txt size={11} color={C.muted}>
        {t('저장될 이름', 'Saved as', '保存される名前')}
      </Txt>
      <View style={{ marginTop: 4 }}>
        {empty ? (
          <Txt size={13} color="#B4B4B4" testID={testID ? `${testID}-empty` : undefined}>
            {empty}
          </Txt>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
