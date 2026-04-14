import React from 'react';
import { View } from 'react-native';

interface Props {
  value: Date;
  mode: 'date' | 'time';
  display?: string;
  onChange: (event: any, date?: Date) => void;
}

export default function DateTimePickerWrapper({ value, mode, onChange }: Props) {
  const toInputValue = (d: Date) => {
    if (mode === 'date') {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const updated = new Date(value);
    if (mode === 'date') {
      const [year, month, day] = val.split('-').map(Number);
      updated.setFullYear(year, month - 1, day);
    } else {
      const [hours, minutes] = val.split(':').map(Number);
      updated.setHours(hours, minutes);
    }
    onChange({}, updated);
  };

  return (
    <View style={{ paddingTop: 8 }}>
      <input
        type={mode === 'date' ? 'date' : 'time'}
        value={toInputValue(value)}
        onChange={handleChange}
        style={{
          fontSize: 16,
          padding: '10px 14px',
          borderRadius: 10,
          border: '1.5px solid #e0d8cc',
          width: '100%',
          backgroundColor: '#faf7f2',
          fontFamily: 'inherit',
          color: '#1a1a1a',
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      />
    </View>
  );
}
