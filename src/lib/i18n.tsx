import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isLocale, tr, type Locale } from './locale';

const KEY = 'pm-language';
const deviceLocale = (): Locale => {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return isLocale(code) ? code : 'en';
};

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (ko: string, en: string, ja: string) => string };
const LocaleContext = createContext<Ctx>({ locale: 'ko', setLocale: () => {}, t: (ko) => ko });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(deviceLocale);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (isLocale(v)) setState(v);
      })
      .catch(() => {});
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({ locale, setLocale, t: (ko, en, ja) => tr(locale, ko, en, ja) }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
