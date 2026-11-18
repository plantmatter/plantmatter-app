import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { C } from '@/lib/theme';

import { SearchIcon } from './icons';
import { fontFor } from './txt';

/** Search box styled like plantmatter.kr: one underline, the magnifier on the right. Filters as you type. */
export function SearchField({ value, onChange, placeholder, testID }: { value: string; onChange: (v: string) => void; placeholder: string; testID?: string }) {
  const input = useRef<TextInputInstance>(null);
  return (
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
        clearButtonMode="while-editing"
        accessibilityLabel={placeholder}
        style={[styles.input, fontFor(value || placeholder)]}
        testID={testID}
      />
      <Pressable onPress={() => input.current?.focus()} hitSlop={8} accessibilityRole="button" accessibilityLabel={placeholder} style={styles.icon}>
        <SearchIcon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.ink, marginBottom: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 0, color: C.ink, outlineWidth: 0 },
  icon: { width: 36, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
});
