import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import NotificationButton from './NotificationButton';
type Props = { title: string; subtitle?: string; subtitleLines?: number; onBack?: () => void; backDisabled?: boolean; home?: boolean; compact?: boolean };
export default function AppHeader({ title, subtitle, subtitleLines = 1, onBack, backDisabled, home, compact }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  useFocusEffect(useCallback(() => { StatusBar.setBarStyle('light-content'); return () => StatusBar.setBarStyle('default'); }, []));
  return <View style={s.header}><LinearGradient pointerEvents="none" colors={['#005638', '#004A30', '#005638']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: -insets.top, bottom: 0, left: 0, right: 0 }} /><View pointerEvents="none" style={s.accent}><Svg width="100%" height="100%" viewBox="0 0 375 18" preserveAspectRatio="none"><Path d="M-20 4 C55 18 135 20 215 9 C285 -1 335 1 395 9 L395 36 L-20 36 Z" fill="#087B50" /></Svg></View><View style={s.row}>
    {!home && <TouchableOpacity accessibilityLabel="Go back" disabled={backDisabled} onPress={onBack || (() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Home' }))} style={s.back}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></TouchableOpacity>}
    <Text style={s.title} numberOfLines={1}>{title}</Text>
    <View style={s.actions}><TouchableOpacity accessibilityLabel="Open messages" onPress={() => navigation.navigate('Messages')} style={s.icon}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#E7F4EC" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2Z" /><Path d="M7 8h10M7 12h6" /></Svg></TouchableOpacity><NotificationButton /></View>
  </View>{!compact && <Text style={s.subtitle} numberOfLines={subtitleLines} accessibilityElementsHidden={!subtitle} importantForAccessibility={subtitle ? 'auto' : 'no-hide-descendants'}>{subtitle || ' '}</Text>}</View>;
}
const s = StyleSheet.create({ accent: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 18 }, header: { backgroundColor: '#005638', paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }, row: { height: 44, flexDirection: 'row', alignItems: 'center' }, back: { width: 34, height: 44, justifyContent: 'center', alignItems: 'flex-start' }, title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: '700', color: '#FFFFFF' }, actions: { flexDirection: 'row', gap: 2, marginLeft: 8 }, icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, dot: { position: 'absolute', right: 5, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D61B' }, subtitle: { minHeight: 17, fontSize: 12, lineHeight: 17, color: '#E7F4EC', marginLeft: 4 } });

