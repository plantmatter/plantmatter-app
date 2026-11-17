import { router } from 'expo-router';
import { View } from 'react-native';

import { SetupNotice } from '@/components/gate';
import { TopBar } from '@/components/top-bar';
import { BigRow, Page } from '@/components/ui';
import { useEvents, useShops } from '@/lib/data';
import { upcomingEvents } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { configured } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function MatterHome() {
  const { t } = useLocale();
  const events = useEvents().data;
  const shops = useShops().data;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar left="none" />
      <Page testID="matter-screen">
        {!configured && <SetupNotice />}
        <BigRow title="Event" count={events ? upcomingEvents(events).length : null} sub={t('식물 행사 · 이벤트', 'PLANT EVENTS', '植物イベント')} onPress={() => router.push('/matter/events')} testID="matter-events" />
        <BigRow title="Shop List" count={shops ? shops.length : null} sub={t('식물 매장 · 쇼룸', 'SHOPS & SHOWROOMS', 'ショップ・ショールーム')} onPress={() => router.push('/matter/shops')} testID="matter-shops" />
      </Page>
    </View>
  );
}
