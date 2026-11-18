import { useQueryClient } from '@tanstack/react-query';
import { getRandomBytes, randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField, TimeField } from '@/components/date-field';
import { FamilyField } from '@/components/family-field';
import { MemberGate } from '@/components/gate';
import { ChevronDown } from '@/components/icons';
import { PhotoField } from '@/components/photos';
import { PlacePicker, type PlaceValue } from '@/components/place-picker';
import { NamePreview, SciName } from '@/components/sci-name';
import { TopBar } from '@/components/top-bar';
import { Txt } from '@/components/txt';
import { Button, ChoiceChips, Field, Label, Loading, Page, ScreenTitle, SectionHead, Segmented, VisibilityField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatCoords, numText, parseCoords, parseDecimal, parseElevation } from '@/lib/coords';
import { topCategories, useCategories, useFinds, usePlants } from '@/lib/data';
import { notify } from '@/lib/dialogs';
import { isDateStr, isTimeStr, todayStr } from '@/lib/format';
import { isCountry, regionOf } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { ABUNDANCE, GROWTH_FORMS, ID_STATUSES, idStatusLabel, MEASUREMENT_BASES, PHENOLOGY, presetText } from '@/lib/labels';
import { cleanAuthority, cleanCultivar, composeFindName, displayName, familyForGenus, findNamePieces, knownFamilies, normalizeFamily, normalizeGenus, parseName, splitQualifier, UNIDENTIFIED, type Qualifier } from '@/lib/names';
import { newOccurrenceId } from '@/lib/occurrence';
import { queuedAsFind, saveFind, useOutbox } from '@/lib/outbox';
import { useSignedUrls, type FormPhoto } from '@/lib/photos';
import { errorText } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { FIND_PHOTO_LIMIT, type Find, type IdStatus } from '@/lib/types';

export default function FindEditScreen() {
  const { t } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />
      <Page testID="find-form">
        <ScreenTitle sub={t('세부 위치와 좌표는 기본으로 비공개입니다. 목록은 나라·지역으로 묶어 보여 줍니다.', 'Locality and coordinates are hidden by default. Lists are grouped by country or region.', '詳細な場所と座標は初期設定で非公開です。一覧は国・地域ごとにまとめて表示します。')}>{id ? 'Edit Observation' : 'New Observation'}</ScreenTitle>
        <MemberGate what={t('관찰 기록', 'My Observations', '観察記録')}>
          <FindForm />
        </MemberGate>
      </Page>
    </View>
  );
}

function FindForm() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const findsQ = useFinds();
  const queued = useOutbox(user?.id);
  if (!params.id) return <FindFormBody key="new" existing={null} />;
  const q = queued.find((x) => x.row.id === params.id);
  const existing = q && user ? queuedAsFind(user.id, q) : (findsQ.data ?? []).find((f) => f.id === params.id) ?? null;
  if (!existing) return findsQ.isLoading ? <Loading /> : null;
  return <FindFormBody key={existing.id} existing={existing} />;
}

type Existing = Find & { pending?: boolean };
type QualChoice = 'none' | Qualifier;
/** Starts from the stored find (edit) or empty (new); state is set once, when the form mounts. */
function FindFormBody({ existing }: { existing: Existing | null }) {
  const { t, locale } = useLocale();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [photos, setPhotos] = useState<FormPhoto[]>(() => (existing?.photo_paths ?? []).map((path) => ({ key: path, path })));
  // Observations saved before v0.1.1 have one free-text name: split it once.
  const initial = existing ? (existing.genus ? { genus: existing.genus, species: existing.species ?? '' } : parseName(existing.scientific_name)) : { genus: '', species: '' };
  const [genus, setGenus] = useState(initial.genus);
  const [qualifier, setQualifier] = useState<QualChoice>(existing?.qualifier ?? 'none');
  const [species, setSpecies] = useState(initial.species);
  const [authority, setAuthority] = useState(existing?.authority ?? '');
  const [cultivar, setCultivar] = useState(existing?.cultivar ?? '');
  const [family, setFamily] = useState(existing?.family ?? '');
  const [familyTyped, setFamilyTyped] = useState(!!existing?.family);
  const [status, setStatus] = useState<IdStatus>(existing?.identification_status ?? 'unidentified');
  const [recordedBy, setRecordedBy] = useState(existing?.recorded_by || profile?.display_name || '');
  const [observedOn, setObservedOn] = useState(existing?.observed_on ?? todayStr());
  const [place, setPlace] = useState<PlaceValue>({ region: existing?.region ?? regionOf(existing?.country_code), place: existing?.country_code ?? null });
  const [locality, setLocality] = useState(existing?.locality ?? '');
  const [coords, setCoords] = useState(formatCoords(existing?.latitude, existing?.longitude));
  const [locationPrivate, setLocationPrivate] = useState(existing?.location_private ?? true);
  const [elevation, setElevation] = useState(existing?.elevation_m != null ? String(existing.elevation_m) : '');
  const [habitat, setHabitat] = useState(existing?.habitat ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  // v0.1.3 field record
  const [observedTime, setObservedTime] = useState(existing?.observed_time ?? '');
  const [growthForm, setGrowthForm] = useState(existing?.growth_form ?? '');
  const [substrate, setSubstrate] = useState(existing?.substrate ?? '');
  const [phenology, setPhenology] = useState(existing?.phenology ?? '');
  const [lux, setLux] = useState(numText(existing?.illuminance_lux));
  const [ppfd, setPpfd] = useState(numText(existing?.ppfd));
  const [temp, setTemp] = useState(numText(existing?.air_temp_c));
  const [humidity, setHumidity] = useState(numText(existing?.humidity_pct));
  const [measuredOn, setMeasuredOn] = useState(existing?.measured_on ?? '');
  const [measuredTime, setMeasuredTime] = useState(existing?.measured_time ?? '');
  const [basis, setBasis] = useState(existing?.measurement_basis ?? '');
  const [device, setDevice] = useState(existing?.measurement_device ?? '');
  const [fieldNumber, setFieldNumber] = useState(existing?.field_number ?? '');
  const [abundance, setAbundance] = useState(existing?.abundance ?? '');
  const [associated, setAssociated] = useState(existing?.associated_species ?? '');
  const [voucher, setVoucher] = useState(existing?.voucher ?? '');
  const [envOpen, setEnvOpen] = useState(() => !!existing && [existing.illuminance_lux, existing.ppfd, existing.air_temp_c, existing.humidity_pct, existing.measured_on, existing.measurement_basis, existing.measurement_device].some((v) => v != null && v !== ''));
  const [colOpen, setColOpen] = useState(() => !!existing && [existing.field_number, existing.abundance, existing.associated_species, existing.voucher].some((v) => v != null && v !== ''));
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolve = useSignedUrls(photos.map((p) => p.path));
  const cats = useCategories().data ?? [];
  const finds = useFinds().data ?? [];
  const plantsForFamily = usePlants().data ?? [];
  const records = [...plantsForFamily, ...finds];
  // Genera already used in My Plants and in earlier observations.
  const known = [...new Set([...topCategories(cats).map((c) => c.name), ...finds.map((f) => f.genus).filter((g): g is string => !!g)])].sort((a, b) => a.localeCompare(b));
  const typed = genus.trim().toLowerCase();
  const genusChoices = known.filter((g) => !typed || (g.toLowerCase().startsWith(typed) && g.toLowerCase() !== typed)).slice(0, 12);
  const split = splitQualifier(species, qualifier === 'none' ? null : qualifier);
  const isSp = qualifier === 'sp.';
  const parts = { genus, qualifier: split.qualifier, species: split.species, authority: isSp ? '' : authority, cultivar: isSp ? cultivar : '' };
  const changeGenus = (v: string) => {
    setGenus(v);
    if (!familyTyped) setFamily(familyForGenus(records, v));
  };
  const changeFamily = (v: string) => {
    setFamily(v);
    setFamilyTyped(true);
  };
  const changeQualifier = (q: QualChoice) => {
    setQualifier(q);
    // sp.: no species epithet and no author; an additional name instead.
    if (q === 'sp.') {
      setSpecies('');
      setAuthority('');
    }
  };
  const pieces = findNamePieces(parts);
  const coordsValue = parseCoords(coords);
  const coordsBad = !!coords.trim() && !coordsValue;
  const elevationValue = parseElevation(elevation);
  const numbers = {
    lux: parseDecimal(lux, 0, 200000),
    ppfd: parseDecimal(ppfd, 0, 3000),
    temp: parseDecimal(temp, -50, 60),
    humidity: parseDecimal(humidity, 0, 100),
  };
  const badNumber = (Object.keys(numbers) as (keyof typeof numbers)[]).find((k) => numbers[k] === 'invalid');
  const num = (v: number | null | 'invalid') => (v === 'invalid' ? null : v);

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        notify(t('위치 권한이 필요합니다', 'Location access needed', '位置情報へのアクセスが必要です'), t('설정 앱에서 PLANT MATTER의 위치 접근을 "앱을 사용하는 동안"으로 허용해 주세요. 좌표는 직접 입력해도 됩니다.', 'Allow location for PLANT MATTER "While Using the App" in Settings, or type the coordinates.', '設定アプリでPLANT MATTERの位置情報を「使用中のみ」許可してください。座標は手入力もできます。'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords(formatCoords(pos.coords.latitude, pos.coords.longitude));
      if (pos.coords.altitude != null && !elevation.trim()) setElevation(String(Math.round(pos.coords.altitude)));
    } catch (e) {
      notify(t('현재 위치를 가져오지 못했습니다', 'Could not get your location', '現在地を取得できませんでした'), errorText(e));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!isDateStr(observedOn)) return notify(t('관찰 일자를 골라 주세요', 'Choose the observation date', '観察日を選んでください'));
    if (coordsBad) return notify(t('좌표 형식을 확인해 주세요', 'Check the coordinates', '座標の形式を確認してください'), t('예: 6.0753, 116.5583 (위도, 경도)', 'e.g. 6.0753, 116.5583 (latitude, longitude)', '例：6.0753, 116.5583（緯度, 経度）'));
    if (elevationValue === 'invalid') return notify(t('해발고도를 확인해 주세요', 'Check the elevation', '標高を確認してください'), t('-500에서 9000 사이의 숫자(m)로 적어 주세요.', 'Use a number of metres between -500 and 9000.', '-500〜9000の数字（m）で入力してください。'));
    if (badNumber)
      return notify(
        t('측정값을 확인해 주세요', 'Check the measurements', '測定値を確認してください'),
        { lux: t('조도: 0–200000 lux', 'Light: 0–200000 lux', '照度：0–200000 lux'), ppfd: 'PPFD: 0–3000', temp: t('기온: -50–60 °C', 'Temperature: -50–60 °C', '気温：-50–60 °C'), humidity: t('상대습도: 0–100 %', 'Humidity: 0–100 %', '相対湿度：0–100 %') }[badNumber],
      );
    setBusy(true);
    try {
      const id = existing?.id ?? randomUUID();
      const result = await saveFind(
        user.id,
        {
          id,
          scientific_name: composeFindName(parts) || UNIDENTIFIED,
          family: normalizeFamily(family),
          cultivar: split.qualifier === 'sp.' ? cleanCultivar(cultivar) || null : null,
          genus: normalizeGenus(genus) || null,
          qualifier: split.qualifier,
          species: split.species || null,
          authority: split.qualifier === 'sp.' ? null : cleanAuthority(authority) || null,
          identification_status: status,
          recorded_by: recordedBy.replace(/\s+/g, ' ').trim().slice(0, 200),
          region: (isCountry(place.place) ? regionOf(place.place) : place.region) ?? null,
          country_code: isCountry(place.place) ? place.place : null,
          locality: locality.trim().slice(0, 300),
          latitude: coordsValue?.lat ?? null,
          longitude: coordsValue?.lon ?? null,
          location_private: locationPrivate,
          elevation_m: elevationValue,
          observed_on: observedOn,
          habitat: habitat.trim().slice(0, 200),
          notes: notes.trim().slice(0, 2000),
          is_private: isPrivate,
          occurrence_id: existing?.occurrence_id ?? newOccurrenceId(observedOn, getRandomBytes),
          observed_time: isTimeStr(observedTime) ? observedTime : null,
          growth_form: growthForm.trim().slice(0, 60),
          substrate: substrate.trim().slice(0, 100),
          phenology: phenology || null,
          illuminance_lux: num(numbers.lux),
          ppfd: num(numbers.ppfd),
          air_temp_c: num(numbers.temp),
          humidity_pct: num(numbers.humidity),
          measured_on: isDateStr(measuredOn) ? measuredOn : null,
          measured_time: isDateStr(measuredOn) && isTimeStr(measuredTime) ? measuredTime : null,
          measurement_basis: basis || null,
          measurement_device: device.trim().slice(0, 100),
          field_number: fieldNumber.trim().slice(0, 50),
          abundance: abundance || null,
          associated_species: associated.trim().slice(0, 300),
          voucher: voucher.trim().slice(0, 200),
        },
        // Photos of a queued find are local copies; treat them as new uploads.
        photos.map((p) => (p.path && /^(file|content):/i.test(p.path) ? { key: p.key.split('/').pop()!.replace(/\.jpg$/, ''), uri: p.path } : p)),
        existing && !existing.pending ? existing.photo_paths : [],
      );
      await qc.invalidateQueries({ queryKey: ['finds'] });
      if (result === 'queued')
        notify(
          t('휴대폰에 보관했습니다', 'Kept on this phone', '端末に保管しました'),
          t('지금은 인터넷에 연결되어 있지 않습니다. 연결되면 자동으로 올라갑니다.', 'You are offline right now. It uploads automatically when you are back online.', '現在オフラインです。接続されると自動でアップロードします。'),
        );
      if (existing) router.back();
      else router.replace(`/finds/${id}`);
    } catch (e) {
      notify(t('저장하지 못했습니다', 'Could not save', '保存できませんでした'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionHead>{t('학명', 'SCIENTIFIC NAME', '学名')}</SectionHead>
      <FamilyField value={family} onChange={changeFamily} known={knownFamilies(records)} testID="find-family" />
      <Field
        label={t('속 (Genus)', 'Genus', '属 (Genus)')}
        value={genus}
        onChangeText={changeGenus}
        placeholder="Bulbophyllum"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        hint={t('모르면 비워 두세요. 아래 버튼으로 전에 쓴 속을 고를 수 있습니다.', 'Leave empty if unknown. Tap a button below to reuse a genus.', '不明なら空欄で。下のボタンで以前の属を選べます。')}
        testID="find-genus"
      />
      {!!genusChoices.length && (
        <View style={styles.chips} testID="find-genus-choices">
          {genusChoices.map((g) => (
            <Pressable key={g} onPress={() => changeGenus(g)} style={styles.chip} accessibilityRole="button" testID={`find-genus-choice-${g}`}>
              <Txt italic size={13}>
                {g}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      <Label>{t('한정어 (선택)', 'Qualifier (optional)', '限定詞（任意）')}</Label>
      <Segmented<QualChoice>
        value={qualifier}
        onChange={changeQualifier}
        options={[
          { value: 'none', label: t('없음', 'None', 'なし') },
          { value: 'sp.', label: 'sp.' },
          { value: 'cf.', label: 'cf.' },
          { value: 'aff.', label: 'aff.' },
        ]}
        testID="find-qualifier"
      />
      <Txt size={10} color={C.muted} style={{ marginTop: -8, marginBottom: 16, lineHeight: 15 }}>
        {t('sp. 속까지만 동정 · cf. 이 종으로 보이지만 확실하지 않음 · aff. 이 종과 가깝지만 다른 종일 수 있음.', 'sp. identified to genus only · cf. looks like this species but not confirmed · aff. close to this species but possibly another.', 'sp. 属まで同定・cf. この種に見えるが未確定・aff. この種に近いが別種の可能性。')}
      </Txt>
      {isSp && (
        <Field label={t('추가 식별명 (선택)', 'Additional name (optional)', '追加識別名（任意）')} value={cultivar} onChangeText={setCultivar} placeholder={t('예: Blue, Bosco Ecuador', 'e.g. Blue, Bosco Ecuador', '例：Blue, Bosco Ecuador')} autoCorrect={false} maxLength={100} testID="find-cultivar" />
      )}
      <Field
        label={t('종소명 (선택)', 'Species (optional)', '種小名（任意）')}
        value={species}
        onChangeText={setSpecies}
        editable={!isSp}
        placeholder={isSp ? t('sp.를 고르면 쓰지 않습니다', 'Not used with sp.', 'sp.では使いません') : 'echinolabium'}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={110}
        style={isSp ? styles.off : undefined}
        testID="find-species"
      />
      <Field
        label={t('명명자 (선택)', 'Author (optional)', '命名者（任意）')}
        value={authority}
        editable={!isSp}
        style={isSp ? styles.off : undefined}
        onChangeText={setAuthority}
        placeholder={t('예: J.J.Sm.', 'e.g. J.J.Sm.', '例：J.J.Sm.')}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
        hint={t('학명을 처음 발표한 사람의 이름입니다. 보통 줄여서 씁니다. 종소명이 있을 때만 이름에 붙습니다.', 'Who first published the name, usually abbreviated. Added to the name only with a species epithet.', '学名を最初に発表した人の名前で、通常は略して書きます。種小名があるときだけ名前に付きます。')}
        testID="find-authority"
      />
      <NamePreview testID="find-name-preview">
        <SciName pieces={pieces.length ? pieces : [{ text: displayName(UNIDENTIFIED, locale), italic: false }]} size={16} testID="find-name-preview-text" />
      </NamePreview>
      <Label>{t('동정 상태', 'Identification', '同定')}</Label>
      <Segmented value={status} onChange={setStatus} options={ID_STATUSES.map((s) => ({ value: s, label: idStatusLabel(s, locale) }))} testID="find-status" />

      <SectionHead>{t('관찰 기록', 'FIELD RECORD', '観察記録')}</SectionHead>
      <DateField label={t('관찰 일자', 'Observation Date', '観察日')} value={observedOn} onChange={setObservedOn} required testID="find-date" />
      <TimeField label={t('발견 시각 (선택)', 'Time (optional)', '発見時刻（任意）')} value={observedTime} onChange={setObservedTime} testID="find-time" />

      <Label>{t('관찰 위치', 'Locality / Coordinates', '観察地点 / 座標')}</Label>
      <PlacePicker mode="find" label={t('나라·지역', 'Country or region', '国・地域')} value={place} onChange={setPlace} testID="find-country" />
      <Field label={t('세부 위치 (선택)', 'Locality (optional)', '詳細な場所（任意）')} value={locality} onChangeText={setLocality} placeholder={t('예: Mt. Kinabalu, Sabah', 'e.g. Mt. Kinabalu, Sabah', '例：Mt. Kinabalu, Sabah')} maxLength={300} testID="find-locality" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label={t('좌표 (위도, 경도)', 'Coordinates (lat, long)', '座標（緯度, 経度）')}
            value={coords}
            onChangeText={setCoords}
            placeholder="6.0753, 116.5583"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            maxLength={80}
            testID="find-coords"
          />
        </View>
        <Button small kind="light" label={t('현재 위치', 'Current location', '現在地')} onPress={locate} busy={locating} style={{ marginTop: 26, minHeight: 46 }} testID="find-locate" />
      </View>
      <Txt size={10} color={coordsBad ? C.danger : C.muted} style={{ marginTop: -8, marginBottom: 16, lineHeight: 15 }} testID="find-coords-hint">
        {coordsBad
          ? t('좌표 형식을 확인해 주세요. 예: 6.0753, 116.5583', 'Check the format, e.g. 6.0753, 116.5583', '形式を確認してください。例：6.0753, 116.5583')
          : t('직접 입력하거나 지도 앱의 좌표를 붙여 넣어도 됩니다. "현재 위치"는 휴대폰 GPS로 채웁니다.', 'Type them, paste from a map app, or tap "Current location" to use the phone GPS.', '手入力や地図アプリからの貼り付けもできます。「現在地」はスマホのGPSで入力します。')}
      </Txt>
      <VisibilityField
        label={t('위치 공개 설정', 'Location visibility', '位置の公開設定')}
        labels={[t('위치 공개', 'Show location', '位置を公開'), t('위치 비공개', 'Hide location', '位置を非公開')]}
        isPrivate={locationPrivate}
        onChange={setLocationPrivate}
        note={t('비공개면 공유 기능이 생긴 뒤에도 다른 사람에게는 나라·지역까지만 보입니다. 희귀 식물 채취를 막기 위해 기본은 비공개입니다.', 'When hidden, others see only the country or region, even after sharing arrives. Hidden by default to protect rare plants.', '非公開の場合、共有機能が加わった後も他の人には国・地域までしか表示されません。希少植物を守るため初期設定は非公開です。')}
        testID="find-location-visibility"
      />
      <Field
        label={t('해발고도 (m)', 'Elevation (m)', '標高（m）')}
        value={elevation}
        onChangeText={setElevation}
        placeholder={t('예: 1800', 'e.g. 1800', '例：1800')}
        keyboardType="numbers-and-punctuation"
        maxLength={8}
        hint={t('"현재 위치"를 쓰면 휴대폰이 알려 준 고도를 채웁니다. GPS 고도는 수십 m 차이가 날 수 있습니다.', '"Current location" fills the phone\'s altitude; GPS altitude can be off by tens of metres.', '「現在地」を使うと端末の高度を入力します。GPSの高度は数十mずれることがあります。')}
        testID="find-elevation"
      />
      <ChoiceChips
        label={t('생육 형태 (선택)', 'Growth form (optional)', '生育形態（任意）')}
        value={growthForm}
        onChange={setGrowthForm}
        options={GROWTH_FORMS.map((g) => ({ value: g.value, label: presetText(g, locale) }))}
        custom={{ label: t('직접 입력', 'Other', '直接入力'), placeholder: t('예: 반착생', 'e.g. semi-epiphytic', '例：半着生') }}
        testID="find-growth"
      />
      <Field label={t('서식지 유형 (선택)', 'Habitat type (optional)', '生息地タイプ（任意）')} value={habitat} onChangeText={setHabitat} placeholder={t('예: 운무림, 계곡 옆', 'e.g. cloud forest, by a stream', '例：雲霧林、渓流沿い')} maxLength={200} testID="find-habitat" />
      <Field label={t('기질 (선택)', 'Substrate (optional)', '基質（任意）')} value={substrate} onChangeText={setSubstrate} placeholder={t('예: 이끼, 나무껍질, 바위', 'e.g. moss, bark, rock', '例：苔、樹皮、岩')} maxLength={100} testID="find-substrate" />
      <ChoiceChips
        label={t('생육 상태 (선택)', 'Phenology (optional)', '生育状態（任意）')}
        value={phenology}
        onChange={setPhenology}
        options={PHENOLOGY.map((g) => ({ value: g.value, label: presetText(g, locale) }))}
        testID="find-phenology"
      />

      <SectionHead>{t('관찰 사진', 'PHOTOGRAPHIC EVIDENCE', '観察写真')}</SectionHead>
      <PhotoField label={t('관찰 사진', 'Photographic Evidence', '観察写真')} photos={photos} onChange={setPhotos} max={FIND_PHOTO_LIMIT} resolve={resolve} testID="find-photos" />
      <Field label={t('현장 관찰 기록', 'Field Notes', 'フィールドノート')} value={notes} onChangeText={setNotes} multiline maxLength={2000} testID="find-notes" />

      <FoldHead title={t('환경 측정 (선택)', 'ENVIRONMENTAL MEASUREMENTS (OPTIONAL)', '環境測定（任意）')} open={envOpen} onPress={() => setEnvOpen(!envOpen)} testID="find-env-toggle" />
      {envOpen && (
        <View testID="find-env">
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Field label={t('조도 (lux)', 'Light (lux)', '照度（lux）')} value={lux} onChangeText={setLux} keyboardType="decimal-pad" placeholder="850" maxLength={9} testID="find-lux" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="PPFD (µmol/m²/s)" value={ppfd} onChangeText={setPpfd} keyboardType="decimal-pad" placeholder="25" maxLength={7} testID="find-ppfd" />
            </View>
          </View>
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Field label={t('기온 (°C)', 'Temperature (°C)', '気温（°C）')} value={temp} onChangeText={setTemp} keyboardType="numbers-and-punctuation" placeholder="23.5" maxLength={6} testID="find-temp" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('상대습도 (%)', 'Humidity (%)', '相対湿度（%）')} value={humidity} onChangeText={setHumidity} keyboardType="decimal-pad" placeholder="88" maxLength={5} testID="find-humidity" />
            </View>
          </View>
          <DateField label={t('측정 날짜', 'Measured on', '測定日')} value={measuredOn} onChange={setMeasuredOn} optional testID="find-measured-on" />
          {!!measuredOn && <TimeField label={t('측정 시각', 'Measured at', '測定時刻')} value={measuredTime} onChange={setMeasuredTime} testID="find-measured-time" />}
          <ChoiceChips label={t('측정 근거', 'Source', '測定根拠')} value={basis} onChange={setBasis} options={MEASUREMENT_BASES.map((g) => ({ value: g.value, label: presetText(g, locale) }))} testID="find-basis" />
          <Field label={t('측정 장비', 'Device', '測定機器')} value={device} onChangeText={setDevice} placeholder={t('예: 장비 모델명', 'e.g. device model', '例：機器のモデル名')} maxLength={100} testID="find-device" />
        </View>
      )}

      <FoldHead title={t('채집·연구 (선택)', 'COLLECTION & RESEARCH (OPTIONAL)', '採集・研究（任意）')} open={colOpen} onPress={() => setColOpen(!colOpen)} testID="find-col-toggle" />
      {colOpen && (
        <View testID="find-col">
          <Field label={t('필드 번호', 'Field number', 'フィールド番号')} value={fieldNumber} onChangeText={setFieldNumber} placeholder={t('예: SB-0123 (내가 붙이는 번호)', 'e.g. SB-0123 (your own number)', '例：SB-0123（自分の番号）')} autoCapitalize="characters" maxLength={50} testID="find-field-number" />
          <Field label={t('관찰자', 'Recorded By', '観察者')} value={recordedBy} onChangeText={setRecordedBy} maxLength={200} hint={t('함께 관찰했다면 이름을 이어서 적어 주세요.', 'Add names if you observed together.', '一緒に観察した人がいれば名前を続けて書いてください。')} testID="find-recorded-by" />
          <ChoiceChips label={t('개체군', 'Abundance', '個体数')} value={abundance} onChange={setAbundance} options={ABUNDANCE.map((g) => ({ value: g.value, label: presetText(g, locale) }))} testID="find-abundance" />
          <Field label={t('동반 식생', 'Associated species', '随伴植生')} value={associated} onChangeText={setAssociated} placeholder={t('예: Nepenthes, 이끼류', 'e.g. Nepenthes, mosses', '例：Nepenthes、コケ類')} maxLength={300} testID="find-associated" />
          <Field label={t('표본·바우처', 'Voucher', '標本・証拠標本')} value={voucher} onChangeText={setVoucher} placeholder={t('예: 없음 / 사진만 / 표본 보관처', 'e.g. none / photos only / where it is kept', '例：なし / 写真のみ / 保管先')} maxLength={200} testID="find-voucher" />
        </View>
      )}

      <VisibilityField label={t('공개 설정', 'Visibility', '公開設定')} isPrivate={isPrivate} onChange={setIsPrivate} testID="find-visibility" />
      <Button label={t('저장', 'SAVE', '保存')} onPress={save} busy={busy} testID="find-save" />
    </View>
  );
}

/** Section that folds open: "환경 측정 (선택)  ∨". */
function FoldHead({ title, open, onPress, testID }: { title: string; open: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.fold} testID={testID}>
      <Txt weight="bold" size={11} style={{ letterSpacing: 1.6, flex: 1 }}>
        {title}
      </Txt>
      <ChevronDown size={20} weight={1.6} up={open} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  off: { opacity: 0.4, backgroundColor: '#ECECEC' },
  pair: { flexDirection: 'row', gap: 10 },
  fold: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 16, paddingBottom: 12, marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#C9C9C9', backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 6 },
});
