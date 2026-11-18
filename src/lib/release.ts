// The release shown in About. Updates sent over the air (EAS Update) keep the native app version
// (app.json "version", which also names the runtime the update must match), so the release is kept here.
import Constants from 'expo-constants';

export const RELEASE = '0.1.3';
/** "v0.1.3 · BETA", plus the installed app build when it differs ("앱 0.1.2"). */
export const nativeVersion = () => Constants.expoConfig?.version ?? '';
