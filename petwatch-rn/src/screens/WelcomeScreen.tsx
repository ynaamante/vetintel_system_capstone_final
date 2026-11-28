import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useOnboarding } from '../context/OnboardingContext';
import { colors, gradients } from '../theme/colors';

const features = [
  { title: 'Pet Health', description: 'Vaccinations and records for every pet, in one place.', icon: 'clipboard-account-outline' },
  { title: 'Appointments', description: 'Book and manage vet visits without the back-and-forth.', icon: 'calendar-month-outline' },
  { title: 'Nearby Clinics', description: 'Find trusted vets close to you, with directions and reviews.', icon: 'map-marker-radius-outline' },
  { title: 'Care Guidance', description: 'Practical advice from veterinary professionals, when you need it.', icon: 'book-open-variant-outline' },
] as const;

const reference = require('../images/welcome-reference.png');
const referenceWidth = 941;
const referenceHeight = 1672;
const maxWidth = 480;
const brandCrop = { left: 259, top: 62, width: 427, height: 267 };
const waveCrop = { left: 0, top: 1502, width: referenceWidth, height: 170 };

function WelcomeArtwork({ crop, scale, label }: { crop: typeof brandCrop; scale: number; label?: string }) {
  // Only the artwork is shown from the reference. The welcome copy and actions are native views.
  return (
    <View
      pointerEvents="none"
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={[styles.artwork, { width: crop.width * scale, height: crop.height * scale }]}
    >
      <Image
        accessible={false}
        source={reference}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: 'absolute',
          left: -crop.left * scale,
          top: -crop.top * scale,
          width: referenceWidth * scale,
          height: referenceHeight * scale,
        }}
      />
    </View>
  );
}

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useOnboarding();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = Math.max(1, Math.min(maxWidth, width - insets.left - insets.right)) / referenceWidth;
  const compact = height - insets.top - insets.bottom < 700 || width < 350;
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

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 10 }],
  }));

  const skip = async () => {
    if (leaving) return;
    setLeaving(true);
    setError('');
    try {
      await completeOnboarding();
    } catch {
      setError('Unable to continue. Please try again.');
      setLeaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.page}>
          <Animated.View style={[styles.content, compact && styles.contentCompact, revealStyle]}>
            <View style={styles.header}>
              <WelcomeArtwork crop={brandCrop} scale={scale} label="VetIntel. Better care. Healthier pets." />
              <Text accessibilityRole="header" style={[styles.welcome, compact && styles.welcomeCompact]}>
                Welcome to VetIntel
              </Text>
            </View>

            <View style={styles.features}>
              {features.map(feature => (
                <View key={feature.title} style={styles.featureCard}>
                  <View style={styles.iconTile} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <MaterialCommunityIcons name={feature.icon} size={32} color={colors.ink} />
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Take a quick tour"
                disabled={leaving}
                onPress={() => navigation.navigate('Walkthrough')}
                activeOpacity={0.85}
                style={styles.tourButton}
              >
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tourGradient}>
                  <Text style={styles.tourText}>Take a Quick Tour</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Skip the tour for now"
                disabled={leaving}
                onPress={skip}
                activeOpacity={0.7}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>{leaving ? 'Continuing…' : 'Skip for Now'}</Text>
              </TouchableOpacity>
              {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            </View>
          </Animated.View>
          <View style={styles.footer}>
            <WelcomeArtwork crop={waveCrop} scale={scale} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  page: { flexGrow: 1, width: '100%', maxWidth },
  content: { paddingTop: 26, paddingHorizontal: 20 },
  contentCompact: { paddingTop: 16, paddingHorizontal: 16 },
  header: { alignItems: 'center' },
  artwork: { overflow: 'hidden' },
  welcome: { marginTop: 19, fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.65, textAlign: 'center', color: colors.ink },
  welcomeCompact: { marginTop: 13, fontSize: 26, lineHeight: 31 },
  features: { gap: 9, marginTop: 60 },
  featureCard: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, gap: 9, backgroundColor: colors.hoverMenu },
  iconTile: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 3, backgroundColor: colors.inputBorder },
  featureCopy: { flex: 1, minWidth: 0 },
  featureTitle: { fontSize: 16, fontWeight: '700', lineHeight: 20, color: colors.ink, marginBottom: 2 },
  featureDescription: { fontSize: 12, lineHeight: 16, color: colors.text },
  actions: { marginTop: 25 },
  tourButton: { borderRadius: 13, overflow: 'hidden' },
  tourGradient: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 16 },
  tourText: { fontSize: 18, fontWeight: '700', color: colors.white, textAlign: 'center' },
  skipButton: { marginTop: 3, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  skipText: { fontSize: 15, fontWeight: '600', color: colors.primary, textAlign: 'center' },
  error: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.dangerText, marginTop: 4 },
  footer: { marginTop: 'auto', alignItems: 'center' },
});
