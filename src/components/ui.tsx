import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { C, GUTTER } from '@/lib/theme';

import { ChevronRight } from './icons';
import { fontFor, Txt } from './txt';

/** Grey scrolling page under the top bar. */
export function Page({ children, style, bg = C.bg, scroll = true, testID }: { children: ReactNode; style?: ViewStyle; bg?: string; scroll?: boolean; testID?: string }) {
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: bg, padding: GUTTER }, style]} testID={testID}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={[{ padding: GUTTER, paddingBottom: 60 }, style]} keyboardShouldPersistTaps="handled" testID={testID}>
      {children}
    </ScrollView>
  );
}

export function ScreenTitle({ children, sub }: { children: string; sub?: string }) {
  return (
    <View style={{ marginTop: 6, marginBottom: 18 }}>
      <Txt weight="bold" size={32} style={{ letterSpacing: -0.6, lineHeight: 38 }}>
        {children}
      </Txt>
      {!!sub && (
        <Txt size={12} color={C.sub} style={{ marginTop: 6, lineHeight: 19 }}>
          {sub}
        </Txt>
      )}
    </View>
  );
}

/** Big type row: "Orchid (3)" with an optional small subtitle; empty rows are pale. */
export function BigRow({ title, count, sub, empty, onPress, lined = true, badge, testID }: { title: string; count?: number | null; sub?: string; empty?: boolean; onPress?: () => void; lined?: boolean; badge?: string; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bigRow, lined && styles.bigRowLined, pressed && { opacity: 0.6 }]} accessibilityRole="button" testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Txt weight="bold" size={32} color={empty ? C.faint : C.ink} style={{ letterSpacing: -0.8, lineHeight: 38, flexShrink: 1 }}>
          {title}
        </Txt>
        {count !== undefined && count !== null && (
          <Txt size={12} color={empty ? '#C6C6C6' : C.muted} style={{ marginLeft: 6, marginTop: 4 }}>
            ({count})
          </Txt>
        )}
        {!!badge && (
          <View style={styles.badge}>
            <Txt weight="bold" size={11} color={C.white}>
              {badge}
            </Txt>
          </View>
        )}
      </View>
      {!!sub && (
        <Txt size={10} color={C.muted} style={{ letterSpacing: 0.6, marginTop: 2 }}>
          {sub}
        </Txt>
      )}
    </Pressable>
  );
}

export function AllTotal({ n }: { n: number }) {
  return (
    <View style={{ alignItems: 'flex-end', marginTop: 34 }} testID="all-total">
      <Txt size={12} color="#666" style={{ marginRight: 4 }}>
        All
      </Txt>
      <Txt weight="black" size={96} style={{ letterSpacing: -4, lineHeight: 96 }}>
        {String(n)}
      </Txt>
    </View>
  );
}

type ButtonKind = 'primary' | 'light' | 'danger' | 'lime';
export function Button({ label, onPress, kind = 'primary', busy, disabled, style, testID, small }: { label: string; onPress: () => void; kind?: ButtonKind; busy?: boolean; disabled?: boolean; style?: ViewStyle; testID?: string; small?: boolean }) {
  const bg = kind === 'primary' ? C.ink : kind === 'lime' ? C.lime : C.white;
  const fg = kind === 'primary' ? C.white : kind === 'danger' ? C.danger : C.ink;
  const border = kind === 'danger' ? '#C99' : kind === 'light' ? '#BDBDBD' : bg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Txt weight={kind === 'primary' ? 'bold' : 'light'} size={small ? 12 : 13} color={fg} style={{ letterSpacing: 0.4 }}>{label}</Txt>}
    </Pressable>
  );
}

export function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <Txt size={12} color="#333" style={{ marginBottom: 7 }}>
      {children}
      {required ? ' *' : ''}
    </Txt>
  );
}

export function Field({ label, hint, required, style, value, ...input }: TextInputProps & { label: string; hint?: string; required?: boolean }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Label required={required}>{label}</Label>
      <TextInput
        placeholderTextColor="#A8A8A8"
        value={value}
        {...input}
        style={[styles.input, fontFor(String(value ?? input.placeholder ?? 'a')), input.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]}
      />
      {!!hint && (
        <Txt size={10} color={C.muted} style={{ marginTop: 6, lineHeight: 15 }}>
          {hint}
        </Txt>
      )}
    </View>
  );
}

/** Looks like an input; opens a picker. */
export function SelectBox({ label, value, placeholder, onPress, required, testID, hint }: { label: string; value: string; placeholder: string; onPress: () => void; required?: boolean; testID?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Label required={required}>{label}</Label>
      <Pressable onPress={onPress} style={[styles.input, styles.select]} accessibilityRole="button" testID={testID}>
        <Txt size={14} weight={value ? 'bold' : 'light'} color={value ? C.ink : '#A8A8A8'} style={{ flex: 1 }} numberOfLines={1}>
          {value || placeholder}
        </Txt>
        <ChevronRight />
      </Pressable>
      {!!hint && (
        <Txt size={10} color={C.muted} style={{ marginTop: 6, lineHeight: 15 }}>
          {hint}
        </Txt>
      )}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange, testID }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testID?: string }) {
  return (
    <View style={styles.segment} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, on && { backgroundColor: C.ink }]} accessibilityRole="button" accessibilityState={{ selected: on }} testID={testID ? `${testID}-${o.value}` : undefined}>
            <Txt size={12} color={on ? C.white : C.ink} weight={on ? 'bold' : 'light'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, sub, value, onChange, testID }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Txt size={13}>{label}</Txt>
        {!!sub && (
          <Txt size={11} color={C.muted} style={{ marginTop: 3, lineHeight: 16 }}>
            {sub}
          </Txt>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.ink, false: '#CFCFCF' }} thumbColor={C.white} testID={testID} />
    </View>
  );
}

export function SectionHead({ children }: { children: string }) {
  return (
    <View style={styles.sectionHead}>
      <Txt weight="bold" size={11} style={{ letterSpacing: 1.6 }}>
        {children}
      </Txt>
    </View>
  );
}

export function Notice({ children, tone = 'info', testID }: { children: ReactNode; tone?: 'info' | 'warning'; testID?: string }) {
  return (
    <View style={[styles.notice, tone === 'warning' && styles.warning]} testID={testID}>
      {typeof children === 'string' ? (
        <Txt size={12} color={tone === 'warning' ? '#7B674A' : '#666'} style={{ lineHeight: 19 }}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </View>
  );
}

export function InfoRow({ label, value, onPress, testID }: { label: string; value: string; onPress?: () => void; testID?: string }) {
  if (!value) return null;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow} testID={testID}>
      <Txt size={12} color="#777" style={{ minWidth: 70 }}>
        {label}
      </Txt>
      <Txt size={13} weight={onPress ? 'bold' : 'light'} style={[{ flex: 1, textAlign: 'right' }, onPress && { textDecorationLine: 'underline' }]}>
        {value}
      </Txt>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator color={C.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  bigRow: { paddingVertical: 12 },
  bigRowLined: { borderBottomWidth: 1.5, borderBottomColor: C.rule, paddingTop: 14, paddingBottom: 12 },
  badge: { marginLeft: 6, marginTop: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  button: { minHeight: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSmall: { minHeight: 34, paddingHorizontal: 10 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: '#DDDDDD', minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: C.ink, marginBottom: 16 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, padding: 14, borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 16 },
  sectionHead: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16, marginTop: 14, marginBottom: 14 },
  notice: { backgroundColor: '#EDEDED', padding: 14, marginVertical: 12 },
  warning: { backgroundColor: '#FAF8F4', borderWidth: 1, borderColor: '#ECE4D5' },
  infoRow: { flexDirection: 'row', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EAEAEA', alignItems: 'flex-start' },
});
