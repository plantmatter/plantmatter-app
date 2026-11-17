import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { Txt } from './txt';

/** Bottom sheet with a title and a scrolling body. */
export function Sheet({ visible, title, onClose, children, testID, scroll = true }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; testID?: string; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('닫기', 'Close', '閉じる')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} testID={testID}>
          <View style={styles.head}>
            <Txt weight="bold" size={16} style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" testID={testID ? `${testID}-close` : undefined}>
              <Txt size={13} color={C.sub}>
                {t('닫기', 'Close', '閉じる')}
              </Txt>
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 18, flex: 1 }}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One choice in a sheet list. */
export function SheetItem({ label, sub, selected, onPress, testID, indent = 0, strong }: { label: string; sub?: string; selected?: boolean; onPress: () => void; testID?: string; indent?: number; strong?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, { paddingLeft: 4 + indent * 16 }, pressed && { backgroundColor: '#F2F2F2' }]} accessibilityRole="button" accessibilityState={{ selected }} testID={testID}>
      <View style={{ flex: 1 }}>
        <Txt size={15} weight={selected || strong ? 'bold' : 'light'}>
          {label}
        </Txt>
        {!!sub && (
          <Txt size={11} color={C.muted} style={{ marginTop: 2 }}>
            {sub}
          </Txt>
        )}
      </View>
      {selected && (
        <Txt weight="bold" size={14}>
          ✓
        </Txt>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.overlay },
  sheet: { backgroundColor: C.white, maxHeight: '82%', minHeight: '45%' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E6E6E6' },
});
