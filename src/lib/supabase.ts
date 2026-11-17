import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
export const isConfigured = /^https:\/\/[^\s]+$/.test(url) && key.length > 20 && !url.includes('YOUR-PROJECT');

// Test builds only (EXPO_PUBLIC_TEST_HOOKS=1): the web e2e suite injects a fake client.
// In store builds this branch is removed because the variable is not set.
const fake: SupabaseClient | undefined =
  process.env.EXPO_PUBLIC_TEST_HOOKS === '1' ? (globalThis as { __PM_FAKE_SUPABASE__?: SupabaseClient }).__PM_FAKE_SUPABASE__ : undefined;

export const supabase: SupabaseClient | null =
  fake ??
  (isConfigured
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          lock: processLock,
        },
      })
    : null);

export const configured = !!supabase;

// Keep the session fresh only while the app is in the foreground (Supabase guidance for React Native).
if (supabase && !fake && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const USER_BUCKET = 'user-photos';
export const MEDIA_BUCKET = 'matter-media';

/** Supabase errors carry a message; network failures are plain TypeErrors. */
export const errorText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));
export const isNetworkError = (e: unknown) => /network|fetch|timed? ?out|offline|internet/i.test(errorText(e));
