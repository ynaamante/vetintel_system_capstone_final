import React from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';

export default function AuthBrand() {
  return <View style={s.brand} accessible accessibilityLabel="VetIntel. Better Care. Healthier Pets.">
    <Image source={require('../images/LogoMark.png')} resizeMode="contain" style={s.mark} />
    <Text style={s.name}>VetIntel</Text>
    <Text style={s.tagline}>Better Care. Healthier Pets.</Text>
  </View>;
}
const s = StyleSheet.create({
  brand: { alignItems: 'center', width: 218, marginBottom: 22 }, mark: { width: 72, height: 72, marginBottom: 3 },
  name: { color: '#005b40', fontSize: 33, lineHeight: 38, fontWeight: '800', letterSpacing: -1 },
  tagline: { color: '#007251', fontSize: 10, fontWeight: '600', lineHeight: 15 },
});
