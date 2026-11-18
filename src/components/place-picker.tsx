import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { REGIONS } from '@/data/geo';
import { choiceKey, choiceLabel, choicesIn, countryLabel, findPlaceLabel, originLabel, regionName, searchPlaces, type PickerMode, type PlaceChoice } from '@/lib/geo';
import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { Sheet, SheetItem } from './sheet';
import { fontFor, Txt } from './txt';
import { SelectBox } from './ui';

export type PlaceValue = { region: string | null; place: string | null };
const RECENT_KEY = 'pm-recent-places';

/**
 * Region → country (finds) or region → island / country / whole region (plant origin).
 * Nothing is typed by hand: everything comes from the list or the search.
 */
export function PlacePicker({ mode, value, onChange, label, testID }: { mode: PickerMode; value: PlaceValue; onChange: (v: PlaceValue) => void; label: string; testID?: string }) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [recent, setRecent] = useState<PlaceChoice[]>([]);

  useEffect(() => {
    if (!open) return;
    AsyncStorage.getItem(RECENT_KEY)
      .then((raw) => {
        const list = raw ? (JSON.parse(raw) as PlaceChoice[]) : [];
        setRecent(list.filter((c) => (mode === 'origin' ? true : mode === 'find' ? c.kind !== 'area' : c.kind === 'country')).slice(0, 6));
      })
      .catch(() => setRecent([]));
  }, [open, mode]);

  const shown = mode === 'country' ? countryLabel(value.place, locale) : mode === 'find' ? findPlaceLabel(value.region, value.place, locale) : originLabel(value.region, value.place, locale);
  const results = useMemo(() => searchPlaces(query, mode), [query, mode]);

  const choose = (c: PlaceChoice | null) => {
    onChange(c ? { region: c.region || null, place: c.place } : { region: null, place: null });
    setOpen(false);
    setQuery('');
    if (c) {
      AsyncStorage.getItem(RECENT_KEY)
        .then((raw) => {
          const list = (raw ? (JSON.parse(raw) as PlaceChoice[]) : []).filter((x) => choiceKey(x) !== choiceKey(c));
          return AsyncStorage.setItem(RECENT_KEY, JSON.stringify([c, ...list].slice(0, 10)));
        })
        .catch(() => {});
    }
  };
  const selectedKey = value.region ? `${value.region}:${value.place ?? ''}` : '';
  const item = (c: PlaceChoice, indent = 1) => (
    <SheetItem
      key={choiceKey(c)}
      label={choiceLabel(c, locale)}
      sub={c.kind === 'area' ? t('섬·지역', 'Island / area', '島・地域') : undefined}
      selected={choiceKey(c) === selectedKey}
      indent={indent}
      onPress={() => choose(c)}
      testID={`${testID}-choice-${c.place ?? `${c.region}-all`}`}
    />
  );

  return (
    <>
      <SelectBox
        label={label}
        value={shown}
        placeholder={t('선택 안 함', 'Not set', '未選択')}
        onPress={() => {
          setOpenRegion(value.region);
          setOpen(true);
        }}
        testID={testID}
        hint={
          mode === 'country'
            ? t('정확한 장소 대신 나라까지만 기록합니다.', 'Only the country is recorded, never the exact spot.', '正確な場所ではなく国だけを記録します。')
            : mode === 'find'
              ? t('나라를 모르면 "동남아시아 전체"처럼 넓은 지역만 골라도 됩니다. 목록은 이것으로 묶입니다.', 'If unsure of the country, a broad region ("all of Southeast Asia") is fine. Lists are grouped by this.', '国が分からなければ「東南アジア全体」のように広い地域だけでも構いません。一覧はこれでまとめます。')
              : t('넓은 지역만 골라도 됩니다.', 'A broad region alone is fine.', '広い地域だけでも構いません。')
        }
      />
      <Sheet visible={open} title={label} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'country' ? t('나라 이름 검색 (예: 말레이, Japan)', 'Search a country (e.g. Malay, Japan)', '国名で検索（例：マレー、Japan）') : mode === 'find' ? t('지역·나라 검색 (예: 동남아, Japan)', 'Search a region or country (e.g. Southeast, Japan)', '地域・国で検索（例：東南、Japan）') : t('지역·섬·나라 검색 (예: Borneo)', 'Search region, island, country (e.g. Borneo)', '地域・島・国で検索（例：Borneo）')}
          placeholderTextColor="#A8A8A8"
          style={[styles.search, fontFor(query || 'a')]}
          autoCorrect={false}
          testID={`${testID}-search`}
        />
        {query.trim() ? (
          results.length ? (
            results.map((c) => (
              <SheetItem
                key={choiceKey(c)}
                label={choiceLabel(c, locale)}
                sub={c.kind === 'region' ? t('지역', 'Region', '地域') : regionName(c.region, locale)}
                selected={choiceKey(c) === selectedKey}
                onPress={() => choose(c)}
                testID={`${testID}-result-${c.place ?? `${c.region}-all`}`}
              />
            ))
          ) : (
            <Txt size={13} color={C.muted} style={{ paddingVertical: 16 }}>
              {t('검색 결과가 없습니다.', 'No matches.', '見つかりません。')}
            </Txt>
          )
        ) : (
          <>
            {!!recent.length && (
              <View style={styles.recent}>
                {recent.map((c) => (
                  <Pressable key={choiceKey(c)} onPress={() => choose(c)} style={styles.chip} accessibilityRole="button">
                    <Txt size={12}>{c.kind === 'country' && mode === 'country' ? choiceLabel(c, locale) : originLabel(c.region, c.place, locale)}</Txt>
                  </Pressable>
                ))}
              </View>
            )}
            {!!shown && <SheetItem label={t('선택 해제', 'Clear', '選択解除')} onPress={() => choose(null)} testID={`${testID}-clear`} />}
            {REGIONS.map((r) => {
              const expanded = openRegion === r.id;
              return (
                <View key={r.id}>
                  <Pressable onPress={() => setOpenRegion(expanded ? null : r.id)} style={styles.region} accessibilityRole="button" accessibilityState={{ expanded }} testID={`${testID}-region-${r.id}`}>
                    <Txt weight="bold" size={16} style={{ flex: 1 }}>
                      {regionName(r.id, locale)}
                    </Txt>
                    <Txt size={16} color="#888">
                      {expanded ? '−' : '+'}
                    </Txt>
                  </Pressable>
                  {expanded && choicesIn(r.id, mode).map((c) => item(c))}
                </View>
              );
            })}
          </>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderColor: '#DDDDDD', minHeight: 44, paddingHorizontal: 12, fontSize: 14, marginTop: 12, marginBottom: 8, color: C.ink },
  recent: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  chip: { borderWidth: 1, borderColor: C.ink, paddingHorizontal: 10, paddingVertical: 6 },
  region: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ECECEC' },
});
