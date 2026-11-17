import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useLocale } from '@/lib/i18n';
import { configured } from '@/lib/supabase';

import { Txt } from './txt';
import { Button, Loading, Notice } from './ui';

export function SetupNotice() {
  const { t } = useLocale();
  return (
    <Notice tone="warning" testID="setup-notice">
      {t(
        '서버 연결 설정이 아직 없습니다. 프로젝트의 .env 파일(또는 EAS 환경 변수)에 Supabase 주소와 Publishable key를 넣어 주세요.',
        'The server connection is not set up. Add the Supabase URL and publishable key to .env (or the EAS environment variables).',
        'サーバー接続がまだ設定されていません。.env（またはEASの環境変数）にSupabaseのURLとPublishable keyを入れてください。',
      )}
    </Notice>
  );
}

/** Shows children only to signed-in, invited testers; explains what is missing otherwise. */
export function MemberGate({ children, what }: { children: ReactNode; what: string }) {
  const { t } = useLocale();
  const { ready, user, member, signOut } = useAuth();
  if (!configured) return <SetupNotice />;
  if (!ready || (user && member === null)) return <Loading />;
  if (!user)
    return (
      <View testID="login-needed">
        <Notice>{t(`${what}은(는) 로그인하면 쓸 수 있습니다.`, `Sign in to use ${what}.`, `${what}はログインすると使えます。`)}</Notice>
        <Button label={t('로그인 / 가입', 'Sign in / Sign up', 'ログイン / 登録')} onPress={() => router.push('/auth')} testID="go-login" />
      </View>
    );
  if (!member)
    return (
      <View testID="not-invited">
        <Notice tone="warning">
          {t(
            `지금은 초대받은 테스터만 쓸 수 있습니다. 로그인한 이메일(${user.email ?? ''})이 초대 명단에 없습니다. 운영자에게 초대를 요청해 주세요.`,
            `For now only invited testers can use this. The signed-in e-mail (${user.email ?? ''}) is not on the invite list. Ask the PLANT MATTER team for an invite.`,
            `現在は招待されたテスターのみ利用できます。ログイン中のメール（${user.email ?? ''}）は招待リストにありません。運営に招待を依頼してください。`,
          )}
        </Notice>
        <Button kind="light" label={t('로그아웃', 'Sign out', 'ログアウト')} onPress={signOut} />
      </View>
    );
  return <>{children}</>;
}

export function EmptyLine({ children }: { children: string }) {
  return (
    <Txt size={13} color="#888" style={{ paddingVertical: 18 }}>
      {children}
    </Txt>
  );
}
