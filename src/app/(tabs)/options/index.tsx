import { router } from 'expo-router';
import { View } from 'react-native';

import { TopBar } from '@/components/top-bar';
import { BigRow, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function OptionsScreen() {
  const { t } = useLocale();
  const { user } = useAuth();
  const rows: { key: string; title: string; sub: string }[] = [
    { key: 'profile', title: 'Profile', sub: t('내 이름 · 내 기록 요약', 'MY NAME · MY RECORDS', 'マイネーム・記録の概要') },
    { key: 'language', title: 'Language', sub: t('앱 표시 언어', 'APP LANGUAGE', '表示言語') },
    { key: 'account', title: 'Account', sub: user ? t('로그인 · 계정 관리', 'SIGN-IN · ACCOUNT', 'ログイン・アカウント') : t('로그인 / 가입', 'SIGN IN / SIGN UP', 'ログイン / 登録') },
    { key: 'about', title: 'About', sub: t('앱 정보 · 약관', 'ABOUT · TERMS', 'アプリ情報・規約') },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar left="none" />
      <Page testID="options-screen">
        {rows.map((r) => (
          <BigRow key={r.key} title={r.title} sub={r.sub} onPress={() => router.push(`/options/${r.key}`)} testID={`opt-${r.key}`} />
        ))}
      </Page>
    </View>
  );
}
