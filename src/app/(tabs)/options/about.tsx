import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';

import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { BigRow, Page, ScreenTitle } from '@/components/ui';
import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function AboutScreen() {
  const { t } = useLocale();
  const version = Constants.expoConfig?.version ?? '0.1.0';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="about-screen">
        <ScreenTitle sub={t('내가 키우는 식물과 야생에서 만난 식물을 기록하고, 식물 행사와 매장을 소개합니다.', 'Record the plants you keep and the plants you meet in the wild, and discover plant events and shops.', '育てている植物と野外で出会った植物を記録し、植物イベントやショップを紹介します。')}>PLANT MATTER</ScreenTitle>
        <Txt size={13} color={C.sub} testID="app-version">{`v${version} · BETA`}</Txt>
        <View style={{ marginTop: 24 }}>
          <BigRow title={t('이용약관', 'Terms', '利用規約')} onPress={() => router.push('/options/legal?doc=terms')} testID="about-terms" />
          <BigRow title={t('개인정보', 'Privacy', 'プライバシー')} onPress={() => router.push('/options/legal?doc=privacy')} testID="about-privacy" />
        </View>
        <Txt size={11} color={C.muted} style={{ marginTop: 28, lineHeight: 17 }}>
          {t('글꼴: Figtree, Noto Sans KR (SIL Open Font License 1.1). 나라 이름: Natural Earth / mledoze countries 데이터.', 'Fonts: Figtree, Noto Sans KR (SIL Open Font License 1.1). Country names: Natural Earth / mledoze countries data.', 'フォント：Figtree、Noto Sans KR（SIL Open Font License 1.1）。国名：Natural Earth / mledoze countries データ。')}
        </Txt>
      </Page>
    </View>
  );
}
