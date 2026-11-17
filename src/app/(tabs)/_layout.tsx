import { Tabs } from 'expo-router/tabs';

import { TabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plant" />
      <Tabs.Screen name="matter" />
      <Tabs.Screen name="options" />
    </Tabs>
  );
}
