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
        <BigRow title="My Plants" count={counts ? plants?.length ?? 0 : null} sub={t('나의 식물 살펴보기', 'BROWSE MY PLANTS', 'わたしの植物を見る')} onPress={() => router.push('/plant/mine')} testID="plant-mine" />
        <BigRow title="My Observations" count={counts ? (finds?.length ?? 0) + pendingNew : null} sub={t('나의 관찰 식물 모아보기', 'ALL MY PLANT OBSERVATIONS', '観察した植物をまとめて見る')} onPress={() => router.push('/plant/wild')} testID="plant-wild" />
      </Page>
    </View>
  );
}
