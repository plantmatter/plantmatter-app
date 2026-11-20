import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BulletRow, ExpandToggle, GridTable, KeyValueRow, Rule, SpacedTitle, SummaryTable } from '@/components/detail';
import { MemberGate } from '@/components/gate';
import { AdaptivePhotoPager } from '@/components/photos';
import { FindName } from '@/components/sci-name';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page, VisibilityField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatCoords } from '@/lib/coords';
import { deleteFindOnline, setFindPrivate, useFinds } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
import { dayLabel, timeLabel } from '@/lib/format';
import { placeShort } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { abundanceLabel, basisLabel, growthFormLabel, idStatusLabel, phenologyLabel } from '@/lib/labels';
import { discardQueued, queuedAsFind, useOutbox } from '@/lib/outbox';
import { useSignedUrls } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function FindDetailScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar onEdit={() => router.push(`/finds/edit?id=${id}`)} editTestID="find-edit" />
      <Page testID="find-detail">
        <MemberGate what={t('관찰 기록', 'My Observations', '観察記録')}>
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
  const [more, setMore] = useState(false);
  const pending = queued.find((q) => q.row.id === id);
  const f = useMemo(() => (pending && user ? queuedAsFind(user.id, pending) : (findsQ.data ?? []).find((x) => x.id === id)), [pending, user, findsQ.data, id]);
  const resolve = useSignedUrls(f?.photo_paths ?? []);
  if (findsQ.isLoading) return <Loading />;
  if (!f) return <Notice>{t('이 기록을 찾을 수 없습니다. 삭제되었을 수 있습니다.', 'This find could not be found. It may have been deleted.', 'この記録が見つかりません。削除された可能性があります。')}</Notice>;

  const togglePrivate = async (v: boolean) => {
    try {
      await setFindPrivate(f.id, v);
      await qc.invalidateQueries({ queryKey: ['finds'] });
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    }
  };
  const remove = async () => {
    if (!user) return;
    const ok = await confirmAsync(t('이 관찰 기록을 삭제할까요?', 'Delete this observation?', 'この観察記録を削除しますか？'), '', t('삭제', 'Delete', '削除'), t('취소', 'Cancel', 'キャンセル'), true);
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

  const copyId = async () => {
    if (!f.occurrence_id) return;
    await Clipboard.setStringAsync(f.occurrence_id);
    notify(t('고유 기록 번호를 복사했습니다', 'Occurrence ID copied', '記録番号をコピーしました'), f.occurrence_id);
  };
  const coords = formatCoords(f.latitude, f.longitude);
  // Compact like a field sheet: 2026.07.11 / 17:45
  const measuredAt = [f.measured_on ? f.measured_on.replace(/-/g, '.') : '', f.measured_time ?? ''].filter(Boolean).join(' / ');
  const env = [
    { label: t('조도', 'Light', '照度'), value: f.illuminance_lux != null ? `${f.illuminance_lux.toLocaleString()} lux` : '', testID: 'find-env-lux' },
    { label: 'PPFD', value: f.ppfd != null ? String(f.ppfd) : '', testID: 'find-env-ppfd' },
    { label: t('기온', 'Temp.', '気温'), value: f.air_temp_c != null ? `${f.air_temp_c} °C` : '', testID: 'find-env-temp' },
    { label: t('상대습도', 'Humidity', '相対湿度'), value: f.humidity_pct != null ? `${f.humidity_pct}%` : '', testID: 'find-env-humidity' },
    { label: t('측정 시각', 'Measured', '測定時刻'), value: measuredAt, testID: 'find-env-at' },
    { label: t('측정 근거', 'Source', '測定根拠'), value: basisLabel(f.measurement_basis, locale), testID: 'find-env-basis' },
    { label: t('측정 장비', 'Device', '測定機器'), value: f.measurement_device, full: true, testID: 'find-env-device' },
  ];
  const research = [
    { label: t('필드 번호', 'Field number', 'フィールド番号'), value: f.field_number, testID: 'find-col-field-number' },
    { label: t('관찰자', 'Observer', '観察者'), value: f.recorded_by, testID: 'find-info-recorded-by' },
    { label: t('개체군', 'Abundance', '個体数'), value: abundanceLabel(f.abundance, locale), testID: 'find-col-abundance' },
    { label: t('동반 식생', 'Associated species', '随伴植生'), value: f.associated_species, testID: 'find-col-associated' },
    { label: t('표본·바우처', 'Voucher', '標本・証拠標本'), value: f.voucher, testID: 'find-col-voucher' },
  ];

  return (
    <View>
      {pending && (
        <Notice tone="warning" testID="find-pending">
          {pending.error
            ? t(`아직 올리지 못했습니다: ${pending.error}`, `Not uploaded yet: ${pending.error}`, `まだアップロードできていません：${pending.error}`)
            : t('이 휴대폰에 보관 중입니다. 인터넷에 연결되면 자동으로 올라갑니다.', 'Kept on this phone. It uploads automatically when you are online.', 'この端末に保管中です。接続されると自動でアップロードします。')}
        </Notice>
      )}
      {f.photo_paths.length > 0 ? (
        <AdaptivePhotoPager flush={!pending} uris={f.photo_paths.map((x) => resolve(x))} testID="find-photos-view" />
      ) : (
        <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 6 }}>
          OBSERVATION
        </Txt>
      )}
      <View style={{ paddingHorizontal: 8, marginTop: 6 }}>
        <SummaryTable
          rows={[
            { label: t('학명', 'Scientific name', '学名'), value: <FindName find={f} size={17} style={{ lineHeight: 23 }} testID="find-title" /> },
            { label: t('과', 'Family', '科'), value: f.family ?? '', testID: 'find-info-family' },
            { label: t('동정 상태', 'Species identified', '同定'), value: idStatusLabel(f.identification_status, locale), testID: 'find-info-status' },
            { label: t('관찰 위치', 'Locality', '観察地点'), value: placeShort(f.region, f.country_code, locale) || t('지정 안 함', 'Not set', '未設定'), testID: 'find-info-country' },
            { label: t('관찰 일자', 'Observation Date', '観察日'), value: dayLabel(f.observed_on, locale), testID: 'find-info-date' },
          ]}
        />
      </View>
      <View style={{ marginTop: 18 }}>
        <ExpandToggle open={more} onPress={() => setMore(!more)} testID="find-more" />
      </View>
      {more && (
        <View testID="find-more-section">
          <Txt weight="black" size={38} style={{ letterSpacing: -1, lineHeight: 46, marginTop: 4, marginBottom: 14 }} testID="find-found-wild">
            Found Wild
          </Txt>
          <Rule />
          <BulletRow label={t('발견 날짜', 'Date', '発見日')} value={dayLabel(f.observed_on, locale)} testID="find-row-date" />
          <BulletRow label={t('발견 시각', 'Time', '発見時刻')} value={timeLabel(f.observed_time, locale)} testID="find-row-time" />
          <BulletRow label={t('세부 위치', 'Locality', '詳細な場所')} value={f.locality} testID="find-info-locality" />
          <BulletRow label={t('좌표', 'Coordinates', '座標')} value={coords} testID="find-info-coords" />
          {(!!coords || !!f.locality) && (
            <BulletRow label={t('위치 공개', 'Location', '位置の公開')} value={f.location_private ? t('비공개 (나라·지역까지만 공개)', 'Hidden (country or region only)', '非公開（国・地域まで）') : t('공개', 'Shown', '公開')} testID="find-info-location-visibility" />
          )}
          <BulletRow label={t('해발고도', 'Elevation', '標高')} value={f.elevation_m != null ? `${f.elevation_m.toLocaleString()} m` : ''} testID="find-info-elevation" />
          <BulletRow label={t('생육 형태', 'Growth form', '生育形態')} value={growthFormLabel(f.growth_form, locale)} testID="find-row-growth" />
          <BulletRow label={t('서식지 유형', 'Habitat', '生息地タイプ')} value={f.habitat} testID="find-info-habitat" />
          <BulletRow label={t('기질', 'Substrate', '基質')} value={f.substrate} testID="find-row-substrate" />
          <BulletRow label={t('생육 상태', 'Phenology', '生育状態')} value={phenologyLabel(f.phenology, locale)} testID="find-row-phenology" />
          {!!f.notes && (
            <View style={{ paddingVertical: 18, paddingHorizontal: 4 }} testID="find-notes-view">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.mark} />
                <Txt weight="bold" size={14}>
                  {t('현장 관찰 기록', 'Field notes', 'フィールドノート')}
                </Txt>
              </View>
              <Txt size={14} color="#333" style={{ lineHeight: 23, marginTop: 10, marginLeft: 22 }}>
                {f.notes}
              </Txt>
            </View>
          )}
          {env.some((c) => c.value) && (
            <View testID="find-env-section">
              <Rule double />
              <SpacedTitle>ENVIRONMENTAL MEASUREMENTS</SpacedTitle>
              <GridTable cells={env} />
            </View>
          )}
          {research.some((c) => c.value) && (
            <View testID="find-col-section">
              <Rule double />
              <SpacedTitle>{'COLLECTION & RESEARCH'}</SpacedTitle>
              <View style={{ borderTopWidth: 1, borderTopColor: C.hair }}>
                {research.map((r) => (
                  <KeyValueRow key={r.label} label={r.label} value={r.value} testID={r.testID} />
                ))}
              </View>
            </View>
          )}
          <View style={{ marginTop: 26 }}>
            {pending ? (
              <InfoRow label={t('공개 설정', 'Visibility', '公開設定')} value={f.is_private ? t('비공개', 'Private', '非公開') : t('공개', 'Public', '公開')} />
            ) : (
              <VisibilityField label={t('공개 설정', 'Visibility', '公開設定')} isPrivate={f.is_private} onChange={togglePrivate} testID="find-visibility-detail" />
            )}
          </View>
          <InfoRow label={t('고유 기록 번호', 'Occurrence ID', '記録番号')} value={f.occurrence_id ?? ''} onPress={copyId} testID="find-info-occurrence" />
          <Button kind="danger" label={t('삭제', 'Delete', '削除')} onPress={remove} busy={busy} style={{ marginTop: 18 }} testID="find-delete" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.4, borderColor: C.ink },
});
