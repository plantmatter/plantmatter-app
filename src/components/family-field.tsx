import { Pressable, StyleSheet, View } from 'react-native';

import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { Txt } from './txt';
import { Field } from './ui';

/** 과 (Family): typed, with buttons for families used before. Shown upright (not part of the italic name). */
export function FamilyField({ value, onChange, known, testID }: { value: string; onChange: (v: string) => void; known: string[]; testID: string }) {
  const { t } = useLocale();
  const typed = value.trim().toLowerCase();
  const choices = known.filter((f) => !typed || (f.toLowerCase().startsWith(typed) && f.toLowerCase() !== typed)).slice(0, 8);
  return (
    <View>
      <Field
        label={t('과 (Family, 선택)', 'Family (optional)', '科（Family・任意）')}
        value={value}
        onChangeText={onChange}
        placeholder="Orchidaceae"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        hint={t('전에 같은 속에 적은 과가 있으면 속을 입력할 때 저절로 채워집니다. 이름에는 붙지 않습니다.', 'Filled in from earlier records of the same genus. Not part of the name.', '以前同じ属に書いた科があれば、属の入力時に自動で入ります。名前には付きません。')}
        testID={testID}
      />
      {!!choices.length && (
        <View style={styles.chips} testID={`${testID}-choices`}>
          {choices.map((f) => (
            <Pressable key={f} onPress={() => onChange(f)} style={styles.chip} accessibilityRole="button" testID={`${testID}-choice-${f}`}>
              <Txt size={13}>{f}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#C9C9C9', backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 6 },
});
