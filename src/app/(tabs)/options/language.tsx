import { View } from 'react-native';

import { SheetItem } from '@/components/sheet';
import { TopBar } from '@/components/top-bar';
import { Page, ScreenTitle } from '@/components/ui';
import { useLocale } from '@/lib/i18n';
import { LOCALE_NAMES, LOCALES } from '@/lib/locale';
import { C } from '@/lib/theme';

export default function LanguageScreen() {
  const { locale, setLocale, t } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page>
        <ScreenTitle sub={t('메뉴와 안내 문구의 언어입니다. 내가 쓴 기록은 바뀌지 않습니다.', 'Language of menus and messages. Your own records are not translated.', 'メニューと案内の言語です。自分の記録は翻訳されません。')}>Language</ScreenTitle>
        <View style={{ backgroundColor: C.white, paddingHorizontal: 14 }}>
          {LOCALES.map((l) => (
            <SheetItem key={l} label={LOCALE_NAMES[l]} selected={l === locale} onPress={() => setLocale(l)} testID={`lang-${l}`} />
          ))}
        </View>
      </Page>
    </View>
  );
}
