import { ActionSheetIOS, Alert, Platform } from 'react-native';

/** Yes/no question that also works in the web test build (React Native Web has no Alert). */
export function confirmAsync(title: string, message: string, ok: string, cancel: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm ? globalThis.confirm(message ? `${title}\n\n${message}` : title) : false);
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function notify(title: string, message = '') {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Pick one of a few actions from the system sheet (iOS action sheet, Android dialog).
 * Resolves with the index of the chosen option, or -1 when cancelled. On web (test build) the first option is taken.
 */
export function chooseAsync(options: string[], cancel: string, title?: string): Promise<number> {
  if (Platform.OS === 'web') return Promise.resolve(0);
  if (Platform.OS === 'ios')
    return new Promise((resolve) =>
      ActionSheetIOS.showActionSheetWithOptions({ options: [...options, cancel], cancelButtonIndex: options.length, title }, (i) => resolve(i === options.length ? -1 : i)),
    );
  return new Promise((resolve) => {
    Alert.alert(title ?? '', '', [...options.map((text, i) => ({ text, onPress: () => resolve(i) })), { text: cancel, style: 'cancel' as const, onPress: () => resolve(-1) }], {
      cancelable: true,
      onDismiss: () => resolve(-1),
    });
  });
}
