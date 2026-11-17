import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { AdminActions } from '@/components/admin-actions';
import { PhotoPager } from '@/components/photos';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, InfoRow, Loading, Notice, Page } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deleteShop, useShops } from '@/lib/data';
import { confirmAsync, notify } from '@/lib/dialogs';
import { instagramHandle, mapsUrl, safeHttpsUrl } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { shopKindLabel } from '@/lib/labels';
import { publicMediaUrl } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function ShopDetail() {
  const { t, locale } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { admin } = useAuth();
  const qc = useQueryClient();
  const q = useShops();
  const [busy, setBusy] = useState(false);
  const s = (q.data ?? []).find((x) => x.id === id);
  const remove = async () => {
    if (!s) return;
    if (!(await confirmAsync(t(`‘${s.name}’ 매장을 삭제할까요?`, `Delete “${s.name}”?`, `「${s.name}」を削除しますか？`), '', t('삭제', 'Delete', '削除'), t('취소', 'Cancel', 'キャンセル'), true))) return;
    setBusy(true);
    try {
      await deleteShop(s);
      await qc.invalidateQueries({ queryKey: ['shops'] });
      router.back();
    } catch (err) {
      notify(t('삭제하지 못했습니다', 'Could not delete', '削除できませんでした'), errorText(err));
      setBusy(false);
    }
  };
  const ig = s ? instagramHandle(s.instagram) : '';
  const web = s ? safeHttpsUrl(s.website) : '';
  const phone = s ? s.phone.replace(/[^\d+]/g, '') : '';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="shop-detail">
        {q.isLoading ? (
          <Loading />
        ) : !s ? (
          <Notice>{t('매장을 찾을 수 없습니다.', 'Shop not found.', 'ショップが見つかりません。')}</Notice>
        ) : (
          <View>
            <Txt size={10} color={C.muted} style={{ letterSpacing: 1.2, marginBottom: 10 }}>SHOP</Txt>
            <PhotoPager uris={s.photo_paths.map(publicMediaUrl)} testID="shop-photos" />
            <Txt weight="bold" size={26} testID="shop-title">{s.name}</Txt>
            <Txt size={13} color={C.sub} style={{ marginTop: 6 }}>{[shopKindLabel(s.kind, locale), s.area].filter(Boolean).join(' · ')}</Txt>
            <View style={{ marginTop: 16 }}>
              <InfoRow label={t('주소', 'Address', '住所')} value={s.address} />
              <InfoRow label={t('운영 시간', 'Hours', '営業時間')} value={s.hours} />
              <InfoRow label={t('전화', 'Phone', '電話')} value={s.phone} onPress={phone ? () => Linking.openURL(`tel:${phone}`) : undefined} testID="shop-phone" />
              <InfoRow label="Instagram" value={ig ? `@${ig}` : ''} onPress={ig ? () => Linking.openURL(`https://www.instagram.com/${ig}/`) : undefined} testID="shop-instagram" />
              <InfoRow label={t('웹사이트', 'Website', 'ウェブサイト')} value={web || ''} onPress={web ? () => Linking.openURL(web) : undefined} testID="shop-website" />
            </View>
            {!!s.address && (
              <Button kind="light" label={t('지도 앱에서 열기 ↗', 'Open in maps ↗', '地図アプリで開く ↗')} onPress={() => Linking.openURL(mapsUrl(s.address, locale))} style={{ marginTop: 16 }} testID="shop-map" />
            )}
            {!!s.description && (
              <Txt size={13} color="#333" style={{ marginTop: 18, lineHeight: 21 }}>
                {s.description}
              </Txt>
            )}
            {admin && <AdminActions onEdit={() => router.push(`/shops/edit?id=${s.id}`)} onDelete={remove} busy={busy} />}
          </View>
        )}
      </Page>
    </View>
  );
}
