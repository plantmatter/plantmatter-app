import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { privacyText, termsText } from '@/content/legal';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { errorText, supabase } from '@/lib/supabase';
import { C, GUTTER } from '@/lib/theme';

import { Txt } from './txt';
import { Button, Field, ScreenTitle } from './ui';

/** First sign-in of an invited tester: a display name and agreement to the terms. */
export function Onboarding() {
  const { needsOnboarding, user } = useAuth();
  if (!needsOnboarding || !user) return null;
  return <OnboardingForm />;
}

function OnboardingForm() {
  const { profile, user, refresh, signOut } = useAuth();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [agree, setAgree] = useState(!!profile?.terms_accepted_at);
  const [open, setOpen] = useState<'terms' | 'privacy' | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async () => {
    if (!supabase || !name.trim() || !agree) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: name.trim().slice(0, 40), terms_accepted_at: profile?.terms_accepted_at ?? new Date().toISOString() });
      if (error) throw error;
      await refresh();
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const doc = (kind: 'terms' | 'privacy', title: string) => (
    <View>
      <Pressable onPress={() => setOpen(open === kind ? null : kind)} style={styles.docHead} accessibilityRole="button" testID={`onb-${kind}`}>
        <Txt weight="bold" size={13} style={{ flex: 1 }}>
          {title}
        </Txt>
        <Txt size={13} color="#888">
          {open === kind ? '−' : '+'}
        </Txt>
      </Pressable>
      {open === kind && (
        <View style={styles.doc}>
          {(kind === 'terms' ? termsText(locale) : privacyText(locale)).map((line, i) => (
            <Txt key={i} size={12} color="#444" style={{ lineHeight: 19, marginBottom: 6 }}>
              {`${i + 1}. ${line}`}
            </Txt>
          ))}
        </View>
      )}
    </View>
  );
  return (
    <Modal visible animationType="slide" onRequestClose={() => {}}>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: GUTTER, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" testID="onboarding">
        <ScreenTitle sub={t('시작하기 전에 표시 이름을 정하고 약관을 확인해 주세요.', 'Choose a display name and review the terms before you start.', '始める前に表示名を決めて、規約を確認してください。')}>Welcome</ScreenTitle>
        <Field label={t('표시 이름', 'Display name', '表示名')} required value={name} onChangeText={setName} maxLength={40} placeholder={t('예: 정글 가드너', 'e.g. Jungle Gardener', '例：ジャングルガーデナー')} testID="onb-name" />
        {doc('terms', t('이용약관', 'Terms of use', '利用規約'))}
        {doc('privacy', t('개인정보 처리방침', 'Privacy policy', 'プライバシーポリシー'))}
        <Pressable onPress={() => setAgree(!agree)} style={styles.agree} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} testID="onb-agree">
          <View style={[styles.box, agree && { backgroundColor: C.ink }]}>{agree && <Txt size={12} color={C.white} weight="bold">✓</Txt>}</View>
          <Txt size={13} style={{ flex: 1, lineHeight: 19 }}>
            {t('이용약관과 개인정보 처리방침에 동의합니다.', 'I agree to the terms of use and the privacy policy.', '利用規約とプライバシーポリシーに同意します。')}
          </Txt>
        </Pressable>
        <Button label={t('시작하기', 'START', 'はじめる')} onPress={save} busy={busy} disabled={!name.trim() || !agree} testID="onb-save" />
        <Button kind="light" label={t('로그아웃', 'Sign out', 'ログアウト')} onPress={signOut} style={{ marginTop: 10 }} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  docHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDDDDD' },
  doc: { backgroundColor: C.white, padding: 14, marginTop: 8 },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  box: { width: 22, height: 22, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
});
