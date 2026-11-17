import { router } from 'expo-router';
import { View } from 'react-native';

import { TopBar } from '@/components/top-bar';
import { BigRow, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFinds, usePlants } from '@/lib/data';
import { useLocale } from '@/lib/i18n';
import { useOutbox } from '@/lib/outbox';
import { C } from '@/lib/theme';

export default function PlantHome() {
  const { t } = useLocale();
  const { user, member } = useAuth();
  const plants = usePlants().data;
  const finds = useFinds().data;
  const queued = useOutbox(user?.id);
  const pendingNew = queued.filter((q) => !(finds ?? []).some((f) => f.id === q.row.id)).length;
  const counts = member === true;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar left="none" />
      <Page testID="plant-screen">
        <BigRow title="My Plants" count={counts ? plants?.length ?? 0 : null} sub={t('내 식물 · 분류별 관리', 'MY COLLECTION BY CATEGORY', 'マイ植物・分類別')} onPress={() => router.push('/plant/mine')} testID="plant-mine" />
        <BigRow title="Wild Finds" count={counts ? (finds?.length ?? 0) + pendingNew : null} sub={t('야생에서 발견한 식물 · 나라 단위', 'PLANTS FOUND IN THE WILD · BY COUNTRY', '野外で見つけた植物・国単位')} onPress={() => router.push('/plant/wild')} testID="plant-wild" />
      </Page>
    </View>
  );
}
