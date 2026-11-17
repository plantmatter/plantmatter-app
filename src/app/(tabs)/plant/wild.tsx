import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MemberGate } from '@/components/gate';
import { ItemRow, Nest, SubRow } from '@/components/rows';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { AllTotal, BigRow, Button, Loading, Notice, Page } from '@/components/ui';
import { REGIONS } from '@/data/geo';
import { useAuth } from '@/lib/auth';
import { useFinds } from '@/lib/data';
import { dayLabel } from '@/lib/format';
import { placeName, regionName, regionOf } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { idStatusLabel } from '@/lib/labels';
import { flushOutbox, queuedAsFind, useOutbox } from '@/lib/outbox';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Find } from '@/lib/types';

const NO_COUNTRY = '__none';

export default function WildFinds() {
  const { t } = useLocale();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onAdd={() => router.push('/finds/edit')} addLabel={t('발견 기록 추가', 'Add a find', '発見を追加')} />
      <Page testID="wild-screen">
        <MemberGate what={t('야생 발견 기록', 'Wild Finds', '野外発見の記録')}>
          <FindsByRegion />
        </MemberGate>
      </Page>
    </View>
  );
}

type Row = Find & { pending?: boolean; pendingError?: string };

function FindsByRegion() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const findsQ = useFinds();
  const queued = useOutbox(user?.id);
  const [openRegion, setOpenRegion] = useState<Set<string>>(new Set());
  const [openCountry, setOpenCountry] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const all: Row[] = useMemo(() => {
    const pending = user ? queued.map((q) => queuedAsFind(user.id, q)) : [];
    const ids = new Set(pending.map((p) => p.id));
    return [...pending, ...(findsQ.data ?? []).filter((f) => !ids.has(f.id))].sort((a, b) => b.observed_on.localeCompare(a.observed_on));
  }, [queued, findsQ.data, user]);
  const resolve = useSignedUrls(all.map((f) => f.photo_paths[0]));

  if (findsQ.isLoading) return <Loading />;
  if (findsQ.error) return <Notice tone="warning">{errorText(findsQ.error)}</Notice>;

  // region → country → finds
  const groups = new Map<string, Map<string, Row[]>>();
  for (const f of all) {
    const region = (f.country_code && regionOf(f.country_code)) || NO_COUNTRY;
    const country = f.country_code || NO_COUNTRY;
    if (!groups.has(region)) groups.set(region, new Map());
    const byCountry = groups.get(region)!;
    byCountry.set(country, [...(byCountry.get(country) ?? []), f]);
  }
  const order = [...REGIONS.map((r) => r.id), NO_COUNTRY].filter((r) => groups.has(r));
  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };
  const upload = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await flushOutbox(user.id);
      await qc.invalidateQueries({ queryKey: ['finds'] });
    } finally {
      setBusy(false);
    }
  };
  const pendingCount = all.filter((f) => f.pending).length;
  const failedOne = all.find((f) => f.pendingError);

  return (
    <View>
      {pendingCount > 0 && (
        <Notice testID="outbox-notice">
          <View style={{ gap: 10 }}>
            <View>
              {[
                t(`인터넷 연결이 없어 이 휴대폰에 보관한 기록이 ${pendingCount}건 있습니다. 연결되면 자동으로 올라갑니다.`, `${pendingCount} find(s) are kept on this phone until you are online again; they upload automatically.`, `${pendingCount}件の記録をこの端末に保管しています。接続されると自動でアップロードします。`),
                failedOne ? t(`올리지 못한 이유: ${failedOne.pendingError}`, `Upload error: ${failedOne.pendingError}`, `アップロードできない理由：${failedOne.pendingError}`) : '',
              ]
                .filter(Boolean)
                .map((line) => (
                  <Txt key={line} size={12} color="#555" style={{ lineHeight: 19 }}>
                    {line}
                  </Txt>
                ))}
            </View>
            <Button small kind="light" label={t('지금 올리기', 'Upload now', '今すぐアップロード')} onPress={upload} busy={busy} testID="outbox-upload" />
          </View>
        </Notice>
      )}
      {!all.length && (
        <Notice>{t('아직 발견 기록이 없습니다. 오른쪽 위 ＋로 첫 기록을 남겨 보세요.', 'No finds yet. Tap ＋ at the top right to add your first one.', 'まだ記録がありません。右上の＋から最初の記録を追加しましょう。')}</Notice>
      )}
      {order.map((region) => {
        const byCountry = groups.get(region)!;
        const n = [...byCountry.values()].reduce((s, l) => s + l.length, 0);
        const open = openRegion.has(region);
        const title = region === NO_COUNTRY ? t('나라 미지정', 'No country', '国未設定') : regionName(region, locale);
        return (
          <View key={region}>
            <BigRow title={title} count={n} lined={false} onPress={() => toggle(openRegion, region, setOpenRegion)} testID={`region-${region}`} />
            {open && (
              <Nest>
                {[...byCountry.entries()]
                  .sort((a, b) => placeName(a[0], locale).localeCompare(placeName(b[0], locale)))
                  .map(([country, list]) => {
                    const key = `${region}:${country}`;
                    const cOpen = openCountry.has(key) || byCountry.size === 1;
                    return (
                      <View key={key}>
                        {byCountry.size > 1 || country !== NO_COUNTRY ? (
                          <SubRow title={country === NO_COUNTRY ? t('나라 미지정', 'No country', '国未設定') : placeName(country, locale)} count={list.length} open={cOpen} onPress={() => toggle(openCountry, key, setOpenCountry)} testID={`country-${country}`} />
                        ) : null}
                        {cOpen && (
                          <Nest light>
                            {list.map((f) => (
                              <ItemRow
                                key={f.id}
                                name={f.scientific_name}
                                meta={[dayLabel(f.observed_on, locale), idStatusLabel(f.identification_status, locale)].join(' · ')}
                                badge={f.pending ? t('업로드 대기', 'WAITING', '送信待ち') : f.is_private ? t('나만 보기', 'PRIVATE', '非公開') : undefined}
                                thumb={resolve(f.photo_paths[0])}
                                onPress={() => router.push(`/finds/${f.id}`)}
                                testID={`find-row-${f.id}`}
                              />
                            ))}
                          </Nest>
                        )}
                      </View>
                    );
                  })}
              </Nest>
            )}
          </View>
        );
      })}
      <AllTotal n={all.length} />
    </View>
  );
}

