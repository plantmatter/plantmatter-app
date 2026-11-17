import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';

import { dayLabel, todayStr } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { Txt } from './txt';
import { Label, SelectBox } from './ui';

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Date (YYYY-MM-DD). iOS: compact native picker; Android: the system dialog. Optional dates can be cleared. */
export function DateField({ label, value, onChange, required, optional, testID }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; optional?: boolean; testID?: string }) {
  const { locale, t } = useLocale();
  const clear =
    optional && value ? (
      <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityRole="button" style={{ marginTop: 6 }}>
        <Txt size={11} color={C.sub} style={{ textDecorationLine: 'underline' }}>
          {t('날짜 지우기', 'Clear date', '日付をクリア')}
        </Txt>
      </Pressable>
    ) : null;

  if (Platform.OS === 'ios') {
    return (
      <View style={{ marginBottom: 16 }}>
        <Label required={required}>{label}</Label>
        {value || !optional ? (
          <View style={{ alignItems: 'flex-start' }}>
            <DateTimePicker value={value ? toDate(value) : new Date()} mode="date" display="compact" onChange={(_, d) => d && onChange(todayStr(d))} testID={testID} />
          </View>
        ) : (
          <Pressable onPress={() => onChange(todayStr())} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Txt size={13} color={C.sub} style={{ textDecorationLine: 'underline' }}>
              {t('날짜 추가', 'Add a date', '日付を追加')}
            </Txt>
          </Pressable>
        )}
        {clear}
      </View>
    );
  }
  const open = () =>
    DateTimePickerAndroid.open({
      value: value ? toDate(value) : new Date(),
      mode: 'date',
      onChange: (event, d) => {
        if (event.type === 'set' && d) onChange(todayStr(d));
      },
    });
  return (
    <View>
      <SelectBox
        label={label}
        required={required}
        value={value ? dayLabel(value, locale) : ''}
        placeholder={optional ? t('선택 안 함', 'Not set', '未選択') : t('날짜 선택', 'Choose a date', '日付を選択')}
        onPress={open}
        testID={testID}
      />
      {clear && <View style={{ marginTop: -10, marginBottom: 12 }}>{clear}</View>}
    </View>
  );
}
