import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GoArrow } from '@/components/icons';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useShops } from '@/lib/data';
import { useLocale } from '@/lib/i18n';
import { shopKindLabel } from '@/lib/labels';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function ShopsScreen() {
  const { t, locale } = useLocale();
  const { admin } = useAuth();
  const q = useShops();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onAdd={admin ? () => router.push('/shops/edit') : undefined} addLabel={t('매장 추가', 'Add shop', 'ショップを追加')} />
      <Page testID="shops-screen">
        <Txt weight="bold" size={30} style={{ marginBottom: 6 }}>Shop List</Txt>
        {q.isLoading ? <Loading /> : q.error ? <Notice tone="warning">{errorText(q.error)}</Notice> : null}
        {(q.data ?? []).map((s) => (
          <Pressable key={s.id} onPress={() => router.push(`/shops/${s.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" testID={`shop-row-${s.id}`}>
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={21}>{s.name}</Txt>
              <Txt size={13} color={C.sub} style={{ marginTop: 6 }}>
                {[shopKindLabel(s.kind, locale), s.area].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            <GoArrow color={C.white} />
          </Pressable>
        ))}
        {!q.isLoading && !(q.data ?? []).length && (
          <Txt size={14} style={styles.empty}>
            {t('등록된 매장이 없습니다.', 'No shops listed yet.', '登録されたショップはありません。')}
          </Txt>
        )}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 22, paddingBottom: 18, borderBottomWidth: 1.5, borderBottomColor: C.ink },
  empty: { paddingVertical: 18, borderBottomWidth: 1.5, borderBottomColor: C.ink },
});
