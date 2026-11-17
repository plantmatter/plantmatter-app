import { View } from 'react-native';

import { useLocale } from '@/lib/i18n';

import { Button } from './ui';

export function AdminActions({ onEdit, onDelete, busy }: { onEdit: () => void; onDelete: () => void; busy?: boolean }) {
  const { t } = useLocale();
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 26 }} testID="admin-actions">
      <Button kind="light" label={t('수정', 'Edit', '編集')} onPress={onEdit} style={{ flex: 1 }} testID="admin-edit" />
      <Button kind="danger" label={t('삭제', 'Delete', '削除')} onPress={onDelete} busy={busy} style={{ flex: 1 }} testID="admin-delete" />
    </View>
  );
}
