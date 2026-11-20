import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SetupNotice } from '@/components/gate';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Notice, Page, ScreenTitle, SectionHead } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmAsync, notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { discardQueued, readOutbox } from '@/lib/outbox';
import { configured, errorText, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function AccountScreen() {
  const { t } = useLocale();
  const { user, member, admin, signOut } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const out = async () => {
    await signOut();
    qc.clear();
  };
  const remove = async () => {
    if (!supabase || !user) return;
    const ok = await confirmAsync(
      t('계정을 삭제할까요?', 'Delete your account?', 'アカウントを削除しますか？'),
      t('내 식물, 관찰 기록, 카테고리, 사진과 plantmatter.kr의 회원 정보(이름·연락처·배송지)가 모두 영구 삭제되며 되돌릴 수 없습니다.', 'Your plants, observations, categories, photos and your plantmatter.kr member details (name, phone, address) are deleted permanently. This cannot be undone.', '植物・観察記録・カテゴリ・写真と、plantmatter.kr の会員情報（名前・電話・住所）がすべて完全に削除され、元に戻せません。'),
      t('삭제', 'Delete', '削除'),
      t('취소', 'Cancel', 'キャンセル'),
      true,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data) throw new Error(String((data as { error: unknown }).error));
      for (const q of await readOutbox(user.id)) await discardQueued(user.id, q.row.id);
      await out();
      notify(t('계정을 삭제했습니다', 'Account deleted', 'アカウントを削除しました'));
      router.replace('/');
    } catch (e) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="account-screen">
        <ScreenTitle>Account</ScreenTitle>
        {!configured ? (
          <SetupNotice />
        ) : !user ? (
          <>
            <Notice>{t('로그인하면 내 식물과 관찰 기록을 저장할 수 있습니다. 행사와 매장은 로그인 없이도 볼 수 있습니다.', 'Sign in to save your plants and observations. Events and shops are open to everyone.', 'ログインすると植物と観察記録を保存できます。イベントとショップはログインなしで見られます。')}</Notice>
            <Button label={t('로그인 / 가입', 'Sign in / Sign up', 'ログイン / 登録')} onPress={() => router.push('/auth')} testID="account-login" />
          </>
        ) : (
          <>
            <InfoRow label={t('이메일', 'E-mail', 'メール')} value={user.email ?? '—'} testID="account-email" />
            <Txt size={11} color={C.muted} style={{ marginTop: 8, lineHeight: 17 }} testID="account-web-note">
              {t('같은 계정으로 plantmatter.kr에도 로그인할 수 있습니다. Apple로만 가입했다면 웹에서 "비밀번호 찾기"로 비밀번호를 먼저 만드세요.', 'The same account signs in on plantmatter.kr. If you joined with Apple only, create a password there with "Forgot password" first.', '同じアカウントで plantmatter.kr にもログインできます。Appleのみで登録した場合は、サイトの「パスワードを忘れた」でパスワードを作ってください。')}
            </Txt>
            <InfoRow label={t('상태', 'Status', '状態')} value={member ? (admin ? t('테스터 · 관리자', 'Tester · Admin', 'テスター・管理者') : t('테스터', 'Tester', 'テスター')) : t('초대되지 않음', 'Not invited', '未招待')} testID="account-status" />
            <Button kind="light" label={t('로그아웃', 'Sign out', 'ログアウト')} onPress={out} style={{ marginTop: 22 }} testID="account-signout" />
            <SectionHead>{t('계정 삭제', 'DELETE ACCOUNT', 'アカウント削除')}</SectionHead>
            <Txt size={12} color={C.sub} style={{ lineHeight: 19, marginBottom: 12 }}>
              {t('계정과 함께 모든 기록과 사진, plantmatter.kr 회원 정보가 바로 삭제됩니다.', 'Your account, all records and photos, and your plantmatter.kr member details are deleted right away.', 'アカウントとすべての記録・写真、plantmatter.kr の会員情報がすぐに削除されます。')}
            </Txt>
            <Button kind="danger" label={t('계정 삭제', 'Delete account', 'アカウントを削除')} onPress={remove} busy={busy} testID="account-delete" />
          </>
        )}
      </Page>
    </View>
  );
}
