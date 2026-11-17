import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PhotoField } from '@/components/photos';
import { TopBar } from '@/components/top-bar';
import { Button, Field, Label, Loading, Notice, Page, ScreenTitle, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { saveShop, useShops } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { safeHttpsUrl } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { SHOP_KINDS, shopKindLabel } from '@/lib/labels';
import { publicMediaUrl, storeFormPhotos, type FormPhoto } from '@/lib/photos';
import { errorText, MEDIA_BUCKET } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { SHOP_PHOTO_LIMIT, type MatterShop, type ShopKind } from '@/lib/types';

export default function ShopEdit() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { admin } = useAuth();
  const q = useShops();
  const existing = id ? (q.data ?? []).find((s) => s.id === id) ?? null : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="shop-form">
        <ScreenTitle>{id ? 'Edit Shop' : 'New Shop'}</ScreenTitle>
        {!admin ? (
          <Notice tone="warning">{t('관리자만 매장을 등록할 수 있습니다.', 'Only admins can list shops.', '管理者のみショップを登録できます。')}</Notice>
        ) : id && !existing ? (
          <Loading />
        ) : (
          <ShopFormBody key={existing?.id ?? 'new'} existing={existing} />
        )}
      </Page>
    </View>
  );
}

function ShopFormBody({ existing }: { existing: MatterShop | null }) {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const [photos, setPhotos] = useState<FormPhoto[]>(() => (existing?.photo_paths ?? []).map((path) => ({ key: path, path })));
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<ShopKind>(existing?.kind ?? 'shop');
  const [area, setArea] = useState(existing?.area ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [hours, setHours] = useState(existing?.hours ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [instagram, setInstagram] = useState(existing?.instagram ?? '');
  const [website, setWebsite] = useState(existing?.website ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [order, setOrder] = useState(String(existing?.sort_order ?? 0));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return notify(t('매장 이름을 입력해 주세요', 'Enter the shop name', 'ショップ名を入力してください'));
    const web = safeHttpsUrl(website);
    if (web === null) return notify(t('웹사이트는 https:// 로 시작해야 합니다', 'Websites must start with https://', 'ウェブサイトは https:// で始めてください'));
    setBusy(true);
    try {
      const shopId = existing?.id ?? randomUUID();
      const photo_paths = await storeFormPhotos(MEDIA_BUCKET, `shops/${shopId}`, photos);
      await saveShop(
        {
          id: shopId,
          name: name.trim().slice(0, 80),
          kind,
          area: area.trim().slice(0, 80),
          address: address.trim().slice(0, 200),
          hours: hours.trim().slice(0, 200),
          phone: phone.trim().slice(0, 40),
          instagram: instagram.trim().slice(0, 80),
          website: web,
          description: description.trim().slice(0, 2000),
          photo_paths,
          sort_order: Number.isFinite(Number(order)) ? Math.round(Number(order)) : 0,
        },
        existing,
      );
      await qc.invalidateQueries({ queryKey: ['shops'] });
      if (existing) router.back();
      else router.replace(`/shops/${shopId}`);
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <PhotoField label={t('사진', 'Photos', '写真')} photos={photos} onChange={setPhotos} max={SHOP_PHOTO_LIMIT} resolve={publicMediaUrl} note={t('누구나 볼 수 있는 공개 사진입니다.', 'Shop photos are public.', 'ショップの写真は公開されます。')} testID="shop-photos-field" />
      <Field label={t('매장 이름', 'Shop name', 'ショップ名')} required value={name} onChangeText={setName} maxLength={80} testID="shop-name" />
      <Label>{t('종류', 'Type', '種類')}</Label>
      <Segmented value={kind} onChange={setKind} options={SHOP_KINDS.map((k) => ({ value: k, label: shopKindLabel(k, locale) }))} testID="shop-kind" />
      <Field label={t('지역', 'Area', 'エリア')} value={area} onChangeText={setArea} maxLength={80} placeholder={t('예: 서울 성수', 'e.g. Seoul Seongsu', '例：ソウル 聖水')} testID="shop-area" />
      <Field label={t('주소', 'Address', '住所')} value={address} onChangeText={setAddress} maxLength={200} hint={t('앱 안에는 지도가 없고, 상세 화면에서 지도 앱으로 엽니다.', 'There is no map in the app; the detail screen opens your maps app.', 'アプリ内に地図はなく、詳細画面から地図アプリで開きます。')} testID="shop-address" />
      <Field label={t('운영 시간', 'Hours', '営業時間')} value={hours} onChangeText={setHours} maxLength={200} testID="shop-hours" />
      <Field label={t('전화', 'Phone', '電話')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} testID="shop-phone-input" />
      <Field label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="@plantmatter" maxLength={80} testID="shop-instagram-input" />
      <Field label={t('웹사이트', 'Website', 'ウェブサイト')} value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="https://" maxLength={300} testID="shop-website-input" />
      <Field label={t('소개', 'Description', '紹介')} value={description} onChangeText={setDescription} multiline maxLength={2000} testID="shop-description" />
      <Field label={t('목록 순서 (작을수록 위)', 'List order (lower first)', '並び順（小さいほど上）')} value={order} onChangeText={setOrder} keyboardType="number-pad" maxLength={6} testID="shop-order" />
      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} testID="shop-save" />
    </View>
  );
}
