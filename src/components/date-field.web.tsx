// Web (test build only): a plain HTML date input.
import { createElement } from 'react';
import { View } from 'react-native';

import { C } from '@/lib/theme';

import { Label } from './ui';

export function DateField({ label, value, onChange, required, testID }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; optional?: boolean; testID?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Label required={required}>{label}</Label>
      {createElement('input', {
        type: 'date',
        value,
        'data-testid': testID,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: { minHeight: 44, border: '1px solid #DDDDDD', padding: '0 10px', fontSize: 14, color: C.ink, background: '#fff' },
      })}
    </View>
  );
}

export function TimeField({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Label>{label}</Label>
      {createElement('input', {
        type: 'time',
        value,
        'data-testid': testID,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: { minHeight: 44, border: '1px solid #DDDDDD', padding: '0 10px', fontSize: 14, color: C.ink, background: '#fff' },
      })}
    </View>
  );
}
