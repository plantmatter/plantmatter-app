import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { fontFor, Txt } from './txt';
import { Button } from './ui';

type Ask = { title: string; message?: string; initial?: string; placeholder?: string; maxLength?: number };
type Ctx = (ask: Ask) => Promise<string | null>;
const PromptContext = createContext<Ctx>(async () => null);

/** Text prompt that works on iOS, Android and web (Android has no built-in text prompt). */
export function PromptProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((v: string | null) => void) | null>(null);
  const prompt = useCallback<Ctx>((a) => {
    resolver.current?.(null);
    setValue(a.initial ?? '');
    setAsk(a);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const finish = (v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setAsk(null);
  };
  const submit = () => {
    const v = value.trim();
    if (v) finish(v);
  };
  return (
    <PromptContext.Provider value={prompt}>
      {children}
      <Modal visible={!!ask} transparent animationType="fade" onRequestClose={() => finish(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(null)} />
          <View style={styles.box} testID="prompt">
            <Txt weight="bold" size={16}>
              {ask?.title ?? ''}
            </Txt>
            {!!ask?.message && (
              <Txt size={12} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
                {ask.message}
              </Txt>
            )}
            <TextInput
              autoFocus
              value={value}
              onChangeText={setValue}
              placeholder={ask?.placeholder}
              placeholderTextColor="#A8A8A8"
              maxLength={ask?.maxLength ?? 40}
              onSubmitEditing={submit}
              returnKeyType="done"
              style={[styles.input, fontFor(value || 'a')]}
              testID="prompt-input"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button kind="light" label={t('취소', 'Cancel', 'キャンセル')} onPress={() => finish(null)} style={{ flex: 1 }} testID="prompt-cancel" />
              <Button label={t('확인', 'OK', 'OK')} onPress={submit} disabled={!value.trim()} style={{ flex: 1 }} testID="prompt-ok" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PromptContext.Provider>
  );
}

export const usePrompt = () => useContext(PromptContext);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.overlay, justifyContent: 'center', padding: 24 },
  box: { backgroundColor: C.white, padding: 20, gap: 14 },
  input: { borderWidth: 1, borderColor: '#DDDDDD', minHeight: 46, paddingHorizontal: 12, fontSize: 15, color: C.ink },
});
