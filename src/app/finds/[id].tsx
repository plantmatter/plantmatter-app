import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { PhotoPager } from '@/components/photos';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deleteFindOnline, useFinds } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
import { dayLabel } from '@/lib/format';
import { countryLabel } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel } from '@/lib/labels';
import { discardQueued, queuedAsFind, useOutbox } from '@/lib/outbox';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function FindDetailScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar
        right={
          <Pressable onPress={() => router.push(`/finds/edit?id=${id}`)} hitSlop={8} style={{ paddingHorizontal: 6, paddingVertical: 10 }} accessibilityRole="button" testID="find-edit">
            <Txt size={13} weight="bold">
              {t('편집', 'EDIT', '編集')}
            </Txt>
          </Pressable>
        }
      />
      <Page testID="find-detail">
        <MemberGate what={t('야생 발견 기록', 'Wild Finds', '野外発見の記録')}>
          <FindDetail id={id} />
        </MemberGate>
      </Page>
    </View>
  );
}

function FindDetail({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const findsQ = useFinds();
  const queued = useOutbox(user?.id);
  const [busy, setBusy] = useState(false);
  const pending = queued.find((q) => q.row.id === id);
  const f = useMemo(() => (pending && user ? queuedAsFind(user.id, pending) : (findsQ.data ?? []).find((x) => x.id === id)), [pending, user, findsQ.data, id]);
  const resolve = useSignedUrls(f?.photo_paths ?? []);
  if (findsQ.isLoading) return <Loading />;
  if (!f) return <Notice>{t('이 기록을 찾을 수 없습니다. 삭제되었을 수 있습니다.', 'This find could not be found. It may have been deleted.', 'この記録が見つかりません。削除された可能性があります。')}</Notice>;

  const remove = async () => {
    if (!user) return;
    const ok = await confirmAsync(t('이 발견 기록을 삭제할까요?', 'Delete this find?', 'この記録を削除しますか？'), '', t('삭제', 'Delete', '削除'), t('취소', 'Cancel', 'キャンセル'), true);
    if (!ok) return;
    setBusy(true);
    try {
      if (pending) await discardQueued(user.id, id);
      const online = (findsQ.data ?? []).find((x) => x.id === id);
      if (online) await deleteFindOnline(online);
      await qc.invalidateQueries({ queryKey: ['finds'] });
      router.back();
    } catch (e) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(e));
      setBusy(false);
    }
  };

  return (
    <View>
      <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 10 }}>
        WILD FIND
      </Txt>
      {pending && (
        <Notice tone="warning" testID="find-pending">
          {pending.error
            ? t(`아직 올리지 못했습니다: ${pending.error}`, `Not uploaded yet: ${pending.error}`, `まだアップロードできていません：${pending.error}`)
            : t('이 휴대폰에 보관 중입니다. 인터넷에 연결되면 자동으로 올라갑니다.', 'Kept on this phone. It uploads automatically when you are online.', 'この端末に保管中です。接続されると自動でアップロードします。')}
        </Notice>
      )}
      <PhotoPager uris={f.photo_paths.map((x) => resolve(x))} testID="find-photos-view" />
      <Txt italic size={26} style={{ lineHeight: 32 }} testID="find-title">
        {f.scientific_name}
      </Txt>
      <View style={{ marginTop: 18 }}>
        <InfoRow label={t('발견한 나라', 'Country', '発見した国')} value={countryLabel(f.country_code, locale) || t('지정 안 함', 'Not set', '未設定')} testID="find-info-country" />
        <InfoRow label={t('발견한 날짜', 'Date', '発見日')} value={dayLabel(f.observed_on, locale)} testID="find-info-date" />
        <InfoRow label={t('동정', 'ID', '同定')} value={idStatusLabel(f.identification_status, locale)} />
        <InfoRow label={t('서식 환경', 'Habitat', '生育環境')} value={f.habitat} />
        <InfoRow label={t('공개', 'Visibility', '公開')} value={f.is_private ? t('나만 보기', 'Only me', '自分だけ') : t('기본', 'Default', '標準')} />
      </View>
      {!!f.notes && (
        <Txt size={13} color="#333" style={{ marginTop: 18, lineHeight: 21 }}>
          {f.notes}
        </Txt>
      )}
      <Button kind="danger" label={t('삭제', 'Delete', '削除')} onPress={remove} busy={busy} style={{ marginTop: 28 }} testID="find-delete" />
    </View>
  );
}
