import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useOnboarding } from '../context/OnboardingContext';

const FEATURES = [
  { title: 'Pet Health', description: 'Vaccinations and records for every pet, in one place.', icon: 'clipboard-outline', badge: 'paw' },
  { title: 'Appointments', description: 'Book and manage vet visits without the back-and-forth.', icon: 'calendar', badge: 'checkmark-circle' },
  { title: 'Nearby Clinics', description: 'Find trusted vets close to you, with directions and reviews.', icon: 'business', badge: 'medical' },
  { title: 'Care Guidance', description: 'Practical advice from veterinary professionals, when you need it.', icon: 'book-outline', badge: 'paw' },
] as const;

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useOnboarding();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height - insets.top - insets.bottom < 720 || width < 350;
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const reveal = useSharedValue(0);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (active) reveal.value = reduced ? 1 : withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    }).catch(() => { if (active) reveal.value = 1; });
    return () => { active = false; };
  }, [reveal]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ translateY: (1 - reveal.value) * 10 }] }));
  const skip = async () => {
    if (leaving) return;
    setLeaving(true); setError('');
    try { await completeOnboarding(); }
    catch { setError('Unable to continue. Please try again.'); setLeaving(false); }
  };

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <View pointerEvents="none" style={styles.waves} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 390 120" preserveAspectRatio="none">
        <Path d="M0 30 C76 34 113 100 200 76 C284 54 327 12 390 24 L390 120 L0 120 Z" fill="#E5F6EF" />
        <Path d="M0 57 C84 31 137 111 224 83 C302 60 333 37 390 40 L390 120 L0 120 Z" fill="#CDEBDC" />
        <Path d="M0 92 C87 70 127 119 213 108 C303 96 341 61 390 68 L390 120 L0 120 Z" fill="#B4DFCA" />
      </Svg>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: compact ? 8 : 18, paddingBottom: Math.max(insets.bottom, 12) + (compact ? 14 : 28) }]}>
      <Animated.View style={[styles.content, revealStyle]}>
        <View style={styles.header}>
          <View accessible accessibilityLabel="Vetintel logo" style={[styles.brand, compact && styles.brandCompact]}>
            <Image source={require('../images/LogoMark.png')} style={[styles.logoMark, compact && styles.logoMarkCompact]} resizeMode="contain" />
            <View style={styles.wordmarkCrop}><Image source={require('../images/LogoWordmarkTagline.png')} style={styles.wordmark} resizeMode="contain" /></View>
            <Text style={styles.brandTagline}>BETTER CARE. HEALTHIER PETS.</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.welcome, compact && styles.welcomeCompact]}>Welcome to Vetintel</Text>
          <View style={styles.taglineRow}><View style={styles.taglineDash} /><Text style={styles.tagline}>BETTER CARE. HEALTHIER PETS.</Text></View>
          <Text style={styles.description}>Your complete pet health companion — built to keep your dogs and cats healthy, and you in the loop.</Text>
        </View>

        <View style={[styles.features, compact && styles.featuresCompact]}>
          {FEATURES.map(feature => <LinearGradient key={feature.title} colors={['#F4FAF6', '#EDF6F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.featureCard, compact && styles.featureCardCompact]}>
            <View style={styles.iconTile} accessible={false} importantForAccessibility="no-hide-descendants">
              <Ionicons name={feature.icon} size={34} color="#0B7958" />
              <View style={[styles.iconBadge, feature.badge === 'medical' && styles.medicalBadge]}><Ionicons name={feature.badge} size={feature.badge === 'medical' ? 15 : 17} color={feature.badge === 'medical' ? '#FFFFFF' : '#008C61'} /></View>
            </View>
            <View style={styles.divider} />
            <View style={styles.featureCopy}><Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.featureDescription}>{feature.description}</Text></View>
          </LinearGradient>)}
        </View>

        <View style={[styles.actions, compact && styles.actionsCompact]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Take a quick tour" disabled={leaving} onPress={() => navigation.navigate('Walkthrough')} activeOpacity={0.85} style={styles.tourButton}>
            <LinearGradient colors={['#007C63', '#4B9A7A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tourGradient}><Text style={styles.tourText}>Take a Quick Tour</Text></LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip the tour for now" disabled={leaving} onPress={skip} activeOpacity={0.7} style={styles.skipButton}><Text style={styles.skipText}>{leaving ? 'Continuing…' : 'Skip for Now'}</Text></TouchableOpacity>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
      </Animated.View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  waves: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 115 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, alignItems: 'center' },
  content: { width: '100%', maxWidth: 460, flexGrow: 1 },
  header: { alignItems: 'center', paddingHorizontal: 5 },
  brand: { alignItems: 'center', marginBottom: 18 },
  brandCompact: { marginBottom: 12 },
  logoMark: { width: 88, height: 70 },
  logoMarkCompact: { width: 74, height: 58 },
  wordmarkCrop: { width: 106, height: 25, overflow: 'hidden', marginTop: 2 },
  wordmark: { width: 106, height: 33 },
  brandTagline: { fontSize: 4.5, lineHeight: 7, letterSpacing: 0.5, fontWeight: '700', color: '#0B6448', textAlign: 'center' },
  welcome: { fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center', color: '#183B2C' },
  welcomeCompact: { fontSize: 26, lineHeight: 32 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, marginBottom: 16, flexWrap: 'wrap' },
  taglineDash: { width: 18, height: 3, borderRadius: 2, backgroundColor: '#00A56A' },
  tagline: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, lineHeight: 15, color: '#3D6554', textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 19, color: '#5A6C62', textAlign: 'center', maxWidth: 355 },
  features: { gap: 9, marginTop: 22 },
  featuresCompact: { marginTop: 16, gap: 7 },
  featureCard: { flexDirection: 'row', alignItems: 'center', minHeight: 77, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, gap: 12 },
  featureCardCompact: { minHeight: 66, paddingVertical: 8, paddingHorizontal: 12, gap: 11 },
  iconTile: { width: 48, height: 48, borderRadius: 13, backgroundColor: '#DDF3E7', alignItems: 'center', justifyContent: 'center' },
  iconBadge: { position: 'absolute', right: 3, bottom: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#E3F6EC', alignItems: 'center', justifyContent: 'center' },
  medicalBadge: { top: 1, right: 1, bottom: undefined, width: 21, height: 21, borderRadius: 4, backgroundColor: '#087052' },
  divider: { width: 1, height: 43, backgroundColor: '#9DD1B9' },
  featureCopy: { flex: 1, minWidth: 0 },
  featureTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19, color: '#24392E', marginBottom: 2 },
  featureDescription: { fontSize: 12, lineHeight: 16, color: '#52645A' },
  actions: { marginTop: 26 },
  actionsCompact: { marginTop: 18 },
  tourButton: { borderRadius: 13, overflow: 'hidden' },
  tourGradient: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  tourText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  skipButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  skipText: { fontSize: 13, fontWeight: '600', color: '#487A65' },
  error: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: '#A22F2F', marginTop: 4 },
});
