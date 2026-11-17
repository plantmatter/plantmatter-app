import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { usePrompt } from '@/components/prompt';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Page, ScreenTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCategories, useFinds, usePlants } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { useLocale } from '@/lib/i18n';
import { errorText, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.white, padding: 14 }}>
      <Txt weight="black" size={28}>{String(n)}</Txt>
      <Txt size={11} color={C.sub} style={{ marginTop: 2 }}>{label}</Txt>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useLocale();
  const { user, profile, admin, refresh } = useAuth();
  const prompt = usePrompt();
  const qc = useQueryClient();
  const plants = usePlants().data ?? [];
  const finds = useFinds().data ?? [];
  const cats = useCategories().data ?? [];
  const rename = async () => {
    const name = await prompt({ title: t('표시 이름', 'Display name', '表示名'), initial: profile?.display_name ?? '', maxLength: 40 });
    if (!name || !supabase || !user) return;
    const { error } = await supabase.from('profiles').update({ display_name: name.slice(0, 40) }).eq('id', user.id);
    if (error) return notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(error));
    await refresh();
    qc.invalidateQueries();
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="profile-screen">
        <ScreenTitle>Profile</ScreenTitle>
        <MemberGate what={t('프로필', 'your profile', 'プロフィール')}>
          <Txt weight="bold" size={24} testID="profile-name">{profile?.display_name || t('이름 없음', 'No name', '名前なし')}</Txt>
          <Txt size={12} color={C.sub} style={{ marginTop: 4 }}>{user?.email ?? ''}{admin ? ` · ${t('관리자', 'Admin', '管理者')}` : ''}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
            <Stat n={plants.length} label={t('내 식물', 'My plants', 'マイ植物')} />
            <Stat n={finds.length} label={t('야생 발견', 'Wild finds', '野外発見')} />
            <Stat n={cats.length} label={t('분류', 'Categories', '分類')} />
          </View>
          <View style={{ marginTop: 20 }}>
            <InfoRow label={t('공개 범위', 'Visibility', '公開範囲')} value={t('이번 버전은 내 기록을 나만 봅니다', 'Only you see your records in this version', 'このバージョンでは自分だけが見られます')} />
          </View>
          <Button kind="light" label={t('이름 바꾸기', 'Change name', '名前を変更')} onPress={rename} style={{ marginTop: 20 }} testID="profile-rename" />
        </MemberGate>
      </Page>
    </View>
  );
}
