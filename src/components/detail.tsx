// Building blocks of the detail screens (v0.1.3): summary table, lime pill buttons, ∨ / ^ toggle,
// "○ label : value" rows, double rules, spaced section titles and the two-column measurement table.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useLocale } from '@/lib/i18n';
import { C } from '@/lib/theme';

import { ChevronDown } from './icons';
import { Txt } from './txt';

/** Label on the left, bold value on the right; no lines (the top of a detail screen). */
export function SummaryTable({ rows }: { rows: { label: string; value: ReactNode; testID?: string }[] }) {
  return (
    <View style={{ gap: 12, paddingVertical: 6 }}>
      {rows
        .filter((r) => r.value !== '' && r.value != null)
        .map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'flex-start' }} testID={r.testID}>
            <Txt size={13} color="#444" style={{ width: '38%', letterSpacing: 0.5, paddingTop: 2 }}>
              {r.label}
            </Txt>
            <View style={{ flex: 1 }}>{typeof r.value === 'string' ? <Txt weight="bold" size={16} style={{ lineHeight: 22 }}>{r.value}</Txt> : r.value}</View>
          </View>
        ))}
    </View>
  );
}

/** Lime pill ("Edit", "주기 리셋"). */
export function Pill({ label, onPress, busy, small, testID }: { label: string; onPress: () => void; busy?: boolean; small?: boolean; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [styles.pill, small && styles.pillSmall, pressed && { opacity: 0.75 }]}>
      {busy ? <ActivityIndicator color={C.ink} /> : <Txt weight="bold" size={small ? 13 : 15}>{label}</Txt>}
    </Pressable>
  );
}

/** Centered ∨ (closed) / ^ (open). */
export function ExpandToggle({ open, onPress, testID }: { open: boolean; onPress: () => void; testID?: string }) {
  const { t } = useLocale();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={open ? t('접기', 'Show less', '閉じる') : t('더 보기', 'Show more', 'もっと見る')} accessibilityState={{ expanded: open }} style={{ alignSelf: 'center', padding: 10 }} testID={testID}>
      <ChevronDown up={open} />
    </Pressable>
  );
}

export const Rule = ({ double, dark }: { double?: boolean; dark?: boolean }) =>
  double ? (
    <View style={{ marginVertical: 18 }}>
      <View style={styles.ruleDark} />
      <View style={[styles.ruleDark, { marginTop: 3 }]} />
    </View>
  ) : (
    <View style={dark ? styles.ruleDark : styles.rule} />
  );

/** "○ 발견 날짜 : 2026. 7. 11" with a line under it. Empty values are left out. */
export function BulletRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  if (!value) return null;
  return (
    <View style={styles.bulletRow} testID={testID}>
      <View style={styles.mark} />
      <Txt size={14} style={{ flex: 1, lineHeight: 21 }}>
        <Txt weight="bold" size={14}>{`${label} : `}</Txt>
        {value}
      </Txt>
    </View>
  );
}

/** Letter-spaced caps title ("ENVIRONMENTAL MEASUREMENTS"). */
export const SpacedTitle = ({ children, testID }: { children: string; testID?: string }) => (
  <Txt weight="bold" size={15} style={{ letterSpacing: 2.4, textAlign: 'center', marginVertical: 22 }} testID={testID}>
    {children}
  </Txt>
);

/** Two cells per line (label bold, value grey); `full` takes the whole line. Empty values read "미기록". */
export function GridTable({ cells, testID }: { cells: { label: string; value: string; full?: boolean; testID?: string }[]; testID?: string }) {
  const { t } = useLocale();
  const lines: (typeof cells)[] = [];
  for (const c of cells) {
    const last = lines[lines.length - 1];
    if (!c.full && last && last.length === 1 && !last[0].full) last.push(c);
    else lines.push([c]);
  }
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.hair }} testID={testID}>
      {lines.map((line, i) => (
        <View key={i} style={styles.gridLine}>
          {line.map((c) => (
            <View key={c.label} style={[styles.gridCell, c.full && { flex: 2 }]} testID={c.testID}>
              <Txt weight="bold" size={13} style={{ width: 64 }}>
                {c.label}
              </Txt>
              <Txt size={13} color={c.value ? '#8A8A8A' : '#B8B8B8'} style={{ flex: 1 }}>
                {c.value || t('미기록', 'Not recorded', '未記録')}
              </Txt>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Bold label on the left, grey value on the right, line under (COLLECTION & RESEARCH). */
export function KeyValueRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.kvRow} testID={testID}>
      <Txt weight="bold" size={14} style={{ flexShrink: 0, maxWidth: '55%' }}>
        {label}
      </Txt>
      <Txt size={14} color={value ? '#8A8A8A' : '#B8B8B8'} style={{ flex: 1, textAlign: 'right' }}>
        {value || t('미기록', 'Not recorded', '未記録')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { backgroundColor: C.lime, borderRadius: 999, minHeight: 46, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  pillSmall: { minHeight: 34, paddingHorizontal: 20 },
  rule: { height: 1, backgroundColor: C.hair },
  ruleDark: { height: 1, backgroundColor: '#9A9A9A' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.hair },
  mark: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.4, borderColor: C.ink },
  gridLine: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.hair },
  gridCell: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, gap: 8 },
  kvRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.hair },
});
