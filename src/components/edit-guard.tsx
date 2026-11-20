import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * While a page is in EDIT, leaving it by accident is blocked: the iOS swipe-back is turned off and the
 * Android back button ends EDIT (like DONE) instead of leaving the page. The top bar hides ‹ itself.
 */
export function EditGuard({ editing, onDone }: { editing: boolean; onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!editing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      done.current();
      return true;
    });
    return () => sub.remove();
  }, [editing]);
  return <Stack.Screen options={{ gestureEnabled: !editing }} />;
}
