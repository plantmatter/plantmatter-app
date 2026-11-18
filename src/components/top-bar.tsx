import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '@/lib/i18n';
import { BAR_HEIGHT, C } from '@/lib/theme';

import { ChevronLeft, Menu, PencilIcon, Plus } from './icons';
import { Txt } from './txt';

type Props = {
  /** 'logo' on HOME, 'back' elsewhere, 'none' for the first screen of a tab. */
  left?: 'logo' | 'back' | 'none';
  onBack?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  /** Pencil icon at the right (detail screens). */
  onEdit?: () => void;
  editTestID?: string;
  onMenu?: () => void;
  right?: ReactNode;
  title?: string;
};

export function TopBar({ left = 'back', onBack, onAdd, addLabel, onEdit, editTestID, onMenu, right, title }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const back = () => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: BAR_HEIGHT + insets.top }]}>
      <View style={styles.side}>
        {left === 'logo' && (
          <Image source={require('@/assets/images/wordmark.png')} style={styles.logo} contentFit="contain" accessibilityLabel="PLANT MATTER" />
        )}
        {left === 'back' && (
          <Pressable onPress={back} hitSlop={10} style={styles.icon} accessibilityRole="button" accessibilityLabel={t('뒤로', 'Back', '戻る')} testID="back">
            <ChevronLeft />
          </Pressable>
        )}
      </View>
      {!!title && (
        <Txt weight="bold" size={14} style={styles.title} numberOfLines={1}>
          {title}
        </Txt>
      )}
      <View style={[styles.side, styles.right]}>
        {right}
        {onEdit && (
          <Pressable onPress={onEdit} hitSlop={10} style={styles.icon} accessibilityRole="button" accessibilityLabel={t('편집', 'Edit', '編集')} testID={editTestID ?? 'top-edit'}>
            <PencilIcon />
          </Pressable>
        )}
        {onAdd && (
          <Pressable onPress={onAdd} hitSlop={10} style={styles.icon} accessibilityRole="button" accessibilityLabel={addLabel ?? t('추가', 'Add', '追加')} testID="top-add">
            <Plus />
          </Pressable>
        )}
        {onMenu && (
          <Pressable onPress={onMenu} hitSlop={10} style={styles.icon} accessibilityRole="button" accessibilityLabel={t('메뉴', 'Menu', 'メニュー')} testID="top-menu">
            <Menu />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DADADA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  side: { flexDirection: 'row', alignItems: 'center', minWidth: 44, flex: 1 },
  right: { justifyContent: 'flex-end', gap: 6 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 14 },
  title: { flex: 2, textAlign: 'center', letterSpacing: 1 },
});
