import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = { value: string; options: string[]; placeholder?: string; label: string; onChange: (value: string) => void; style?: StyleProp<ViewStyle> };
export default function MobileSelect({ value, options, placeholder = 'Select...', label, onChange, style }: Props) {
  const { colors: tc, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const trigger = useRef<React.ComponentRef<typeof View>>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  useEffect(() => { setPosition(null); }, [width, height]);
  const open = () => trigger.current?.measureInWindow((x, y, w, h) => {
    const desired = Math.min(options.length * 44 + 8, 264);
    const below = height - y - h - 12;
    const above = y - 12;
    const upwards = below < Math.min(desired, 160) && above > below;
    const available = Math.max(44, upwards ? above : below);
    const maxHeight = Math.min(desired, available);
    setPosition({ left: Math.max(8, Math.min(x, width - w - 8)), top: upwards ? Math.max(8, y - maxHeight - 5) : y + h + 5, width: Math.min(w, width - 16), maxHeight });
  });
  return <>
    <View ref={trigger} collapsable={false} style={style}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={label + ': ' + (value || placeholder)} accessibilityState={{ expanded: !!position }} onPress={open} style={[s.trigger, { borderColor: position ? '#33845B' : isDark ? tc.border : '#BCD5C6', backgroundColor: isDark ? tc.inputBg : '#FAFBFA' }]}>
        <Text style={[s.value, { color: value ? tc.text : tc.textMuted }]}>{value || placeholder}</Text><Ionicons name={position ? 'chevron-up' : 'chevron-down'} size={16} color={tc.textSecondary} />
      </TouchableOpacity>
    </View>
    <Modal visible={!!position} transparent animationType="none" statusBarTranslucent onRequestClose={() => setPosition(null)}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close dropdown" onPress={() => setPosition(null)} />
      {!!position && <View style={[s.menu, position, { backgroundColor: tc.surface, borderColor: isDark ? tc.border : '#CEE0D4' }]} accessibilityViewIsModal>
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>{options.map(option => <TouchableOpacity key={option} accessibilityRole="radio" accessibilityState={{ checked: option === value }} onPress={() => { onChange(option); setPosition(null); }} style={[s.option, option === value && { backgroundColor: isDark ? '#1B4530' : '#E8F4EC' }]}>
          <Text style={[s.optionText, { color: option === value ? isDark ? '#B6DDC7' : '#005638' : tc.text }]}>{option}</Text>{option === value && <Ionicons name="checkmark" size={18} color={isDark ? '#B6DDC7' : '#005638'} />}
        </TouchableOpacity>)}</ScrollView>
      </View>}
    </Modal>
  </>;
}
const s = StyleSheet.create({
  trigger: { minHeight: 42, borderWidth: 1, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between', paddingHorizontal: 9 },
  value: { flex: 1, fontSize: 14, lineHeight: 20 },
  menu: { position: 'absolute', borderWidth: 1, borderRadius: 10, paddingVertical: 4, overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 10, elevation: 8 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 4, borderRadius: 6 },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
