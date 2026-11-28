import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';

export default function ConversationToast({ text1, text2 }: { text1?: string; text2?: string }) {
  const [loaded] = useFonts({ VetIntelToastBold: require('../assets/fonts/Lato-Bold.ttf') });
  return <LinearGradient colors={['#005638', '#004C32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Ionicons name="checkmark-circle-outline" size={26} color="#F3FFF7" />
    <View style={s.content}>
      <Text style={[s.title, loaded && { fontFamily: 'VetIntelToastBold', fontWeight: 'normal' }]}>{text1}</Text>
      {!!text2 && <Text style={s.description}>{text2}</Text>}
    </View>
  </LinearGradient>;
}

const s = StyleSheet.create({
  banner: { width: '97%', maxWidth: 500, minHeight: 60, borderRadius: 15, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 4 },
  content: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  description: { color: '#E7F4EC', fontSize: 14, lineHeight: 19, marginTop: 1 },
});
