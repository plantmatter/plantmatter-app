import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Page, ScreenTitle } from '@/components/ui';
import { privacyText, termsText } from '@/content/legal';
import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const { t, locale } = useLocale();
  const privacy = doc === 'privacy';
  const lines = privacy ? privacyText(locale) : termsText(locale);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="legal-screen">
        <ScreenTitle>{privacy ? t('개인정보 처리방침', 'Privacy policy', 'プライバシーポリシー') : t('이용약관', 'Terms of use', '利用規約')}</ScreenTitle>
        {lines.map((line, i) => (
          <Txt key={i} size={13} color="#333" style={{ lineHeight: 21, marginBottom: 10 }}>
            {`${i + 1}. ${line}`}
          </Txt>
        ))}
      </Page>
    </View>
  );
}
