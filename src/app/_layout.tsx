import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Network from 'expo-network';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Onboarding } from '@/components/onboarding';
import { PromptProvider } from '@/components/prompt';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LocaleProvider } from '@/lib/i18n';
import { flushOutbox, outboxSupported } from '@/lib/outbox';
import { C, F } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

/** Uploads finds that were saved without signal: at start, when the app comes back, and when the network returns. */
function OutboxRunner() {
  const { user, member } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!outboxSupported || !user || member !== true) return;
    const run = () =>
      flushOutbox(user.id)
        .then((n) => {
          if (n) qc.invalidateQueries({ queryKey: ['finds'] });
        })
        .catch(() => {});
    run();
    const app = AppState.addEventListener('change', (s) => s === 'active' && run());
    const net = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) run();
    });
    return () => {
      app.remove();
      net.remove();
    };
  }, [user, member, qc]);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [F.latinLight]: require('@/assets/fonts/Figtree_300Light.ttf'),
    [F.latinLightItalic]: require('@/assets/fonts/Figtree_300Light_Italic.ttf'),
    [F.latinBold]: require('@/assets/fonts/Figtree_700Bold.ttf'),
    [F.latinBlack]: require('@/assets/fonts/Figtree_800ExtraBold.ttf'),
    [F.koLight]: require('@/assets/fonts/NotoSansKR-300Light.ttf'),
    [F.koBold]: require('@/assets/fonts/NotoSansKR-700Bold.ttf'),
  });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <AuthProvider>
            <PromptProvider>
              <StatusBar style="dark" />
              <OutboxRunner />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
              </Stack>
              <Onboarding />
            </PromptProvider>
          </AuthProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
