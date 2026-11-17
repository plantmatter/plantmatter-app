import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { SetupNotice } from '@/components/gate';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, Field, Notice, Page, ScreenTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { configured, errorText, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

type Mode = 'signin' | 'signup' | 'verify' | 'reset' | 'reset-code';

/**
 * E-mail sign-in with 6-digit codes (no links to open in a browser), plus Apple sign-in on iPhone.
 * Supabase e-mail templates must contain {{ .Token }} — see README.
 */
export default function AuthScreen() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [apple, setApple] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setApple).catch(() => setApple(false));
  }, []);
  useEffect(() => {
    // Signed in (by any route) → back to where the user was.
    if (!user || mode === 'reset-code') return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [user, mode]);

  const cleanEmail = email.trim().toLowerCase();
  const run = async (fn: () => Promise<void>) => {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(friendly(errorText(e)));
    } finally {
      setBusy(false);
    }
  };
  const friendly = (m: string) => {
    if (/invalid login credentials/i.test(m)) return t('이메일 또는 비밀번호가 맞지 않습니다.', 'Wrong e-mail or password.', 'メールアドレスまたはパスワードが違います。');
    if (/email not confirmed/i.test(m)) return t('이메일 인증이 아직 끝나지 않았습니다. 가입할 때 받은 코드를 입력해 주세요.', 'Your e-mail is not confirmed yet. Enter the code from the sign-up e-mail.', 'メール認証が完了していません。登録時のコードを入力してください。');
    if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(m)) return t('코드가 맞지 않거나 만료되었습니다. 새 코드를 받아 주세요.', 'The code is wrong or expired. Request a new one.', 'コードが違うか期限切れです。新しいコードを受け取ってください。');
    if (/password/i.test(m) && /(6|8|short|weak)/i.test(m)) return t('비밀번호를 8자 이상으로 정해 주세요.', 'Use a password of at least 8 characters.', 'パスワードは8文字以上にしてください。');
    if (/rate limit|too many/i.test(m)) return t('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 'Too many attempts. Try again in a moment.', 'リクエストが多すぎます。しばらくしてから再度お試しください。');
    return m;
  };
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  const signIn = () =>
    run(async () => {
      const { error } = await supabase!.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
    });
  const signUp = () =>
    run(async () => {
      if (password.length < 8) throw new Error('password too short (8)');
      const { data, error } = await supabase!.auth.signUp({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.session) {
        setMode('verify');
        setMessage(t('이메일로 6자리 코드를 보냈습니다.', 'We sent a 6-digit code to your e-mail.', 'メールで6桁のコードを送りました。'));
      }
    });
  const verify = () =>
    run(async () => {
      let { error } = await supabase!.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'email' });
      if (error) ({ error } = await supabase!.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'signup' }));
      if (error) throw error;
    });
  const resend = () =>
    run(async () => {
      const { error } = await supabase!.auth.resend({ type: 'signup', email: cleanEmail });
      if (error) throw error;
      setMessage(t('코드를 다시 보냈습니다.', 'Code sent again.', 'コードを再送しました。'));
    });
  const requestReset = () =>
    run(async () => {
      const { error } = await supabase!.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      setMode('reset-code');
      setMessage(t('비밀번호 재설정 코드를 이메일로 보냈습니다.', 'We e-mailed you a reset code.', 'パスワード再設定コードをメールで送りました。'));
    });
  const resetWithCode = () =>
    run(async () => {
      if (password.length < 8) throw new Error('password too short (8)');
      const { error } = await supabase!.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'recovery' });
      if (error) throw error;
      const upd = await supabase!.auth.updateUser({ password });
      if (upd.error) throw upd.error;
      notify(t('비밀번호를 바꿨습니다', 'Password changed', 'パスワードを変更しました'));
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });
  const appleSignIn = () =>
    run(async () => {
      try {
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        });
        if (!cred.identityToken) throw new Error('Apple did not return a token');
        const { data, error } = await supabase!.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
        if (error) throw error;
        // Apple sends the name only on the very first sign-in.
        const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ').trim();
        if (name && data.user) await supabase!.from('profiles').upsert({ id: data.user.id, display_name: name.slice(0, 40) });
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') return;
        throw e;
      }
    });

  const titles: Record<Mode, string> = {
    signin: 'Sign in',
    signup: 'Sign up',
    verify: t('이메일 인증', 'Confirm e-mail', 'メール認証'),
    reset: t('비밀번호 찾기', 'Reset password', 'パスワード再設定'),
    'reset-code': t('새 비밀번호', 'New password', '新しいパスワード'),
  };
  const link = (label: string, to: Mode, testID: string) => (
    <Pressable onPress={() => { setMode(to); setMessage(''); setCode(''); }} hitSlop={6} accessibilityRole="button" testID={testID}>
      <Txt size={13} color={C.sub} style={{ textDecorationLine: 'underline' }}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar left="back" />
      <Page testID="auth-screen">
        <ScreenTitle sub={t('초대받은 테스터 계정으로 로그인해 주세요.', 'Sign in with the account you were invited with.', '招待されたアカウントでログインしてください。')}>{titles[mode]}</ScreenTitle>
        {!configured && <SetupNotice />}
        {mode !== 'reset-code' && mode !== 'verify' && (
          <Field label={t('이메일', 'E-mail', 'メールアドレス')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" testID="auth-email" />
        )}
        {(mode === 'verify' || mode === 'reset-code') && (
          <>
            <Txt size={13} color={C.sub} style={{ marginBottom: 12 }}>
              {cleanEmail}
            </Txt>
            <Field label={t('6자리 코드', '6-digit code', '6桁のコード')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" testID="auth-code" />
          </>
        )}
        {(mode === 'signin' || mode === 'signup' || mode === 'reset-code') && (
          <Field
            label={mode === 'reset-code' ? t('새 비밀번호 (8자 이상)', 'New password (8+ characters)', '新しいパスワード（8文字以上）') : mode === 'signup' ? t('비밀번호 (8자 이상)', 'Password (8+ characters)', 'パスワード（8文字以上）') : t('비밀번호', 'Password', 'パスワード')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            testID="auth-password"
          />
        )}
        {!!message && <Notice testID="auth-message">{message}</Notice>}
        {mode === 'signin' && <Button label={t('로그인', 'SIGN IN', 'ログイン')} onPress={signIn} busy={busy} disabled={!validEmail || !password} testID="auth-submit" />}
        {mode === 'signup' && <Button label={t('가입하기', 'SIGN UP', '登録する')} onPress={signUp} busy={busy} disabled={!validEmail || password.length < 8} testID="auth-submit" />}
        {mode === 'verify' && <Button label={t('확인', 'CONFIRM', '確認')} onPress={verify} busy={busy} disabled={code.length < 6} testID="auth-submit" />}
        {mode === 'reset' && <Button label={t('코드 받기', 'SEND CODE', 'コードを送る')} onPress={requestReset} busy={busy} disabled={!validEmail} testID="auth-submit" />}
        {mode === 'reset-code' && <Button label={t('비밀번호 바꾸기', 'CHANGE PASSWORD', 'パスワードを変更')} onPress={resetWithCode} busy={busy} disabled={code.length < 6 || password.length < 8} testID="auth-submit" />}

        <View style={{ gap: 14, marginTop: 20 }}>
          {mode === 'signin' && link(t('처음이신가요? 계정 만들기', 'New here? Create an account', '初めての方：アカウント作成'), 'signup', 'auth-to-signup')}
          {mode === 'signin' && link(t('비밀번호를 잊었어요', 'Forgot password', 'パスワードを忘れた'), 'reset', 'auth-to-reset')}
          {mode === 'verify' && (
            <Pressable onPress={resend} hitSlop={6} accessibilityRole="button" testID="auth-resend">
              <Txt size={13} color={C.sub} style={{ textDecorationLine: 'underline' }}>
                {t('코드 다시 받기', 'Send the code again', 'コードを再送する')}
              </Txt>
            </Pressable>
          )}
          {mode !== 'signin' && link(t('로그인으로 돌아가기', 'Back to sign in', 'ログインに戻る'), 'signin', 'auth-to-signin')}
        </View>

        {apple && (mode === 'signin' || mode === 'signup') && (
          <View style={{ marginTop: 30 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={0}
              style={{ height: 46 }}
              onPress={appleSignIn}
            />
          </View>
        )}
      </Page>
    </View>
  );
}
