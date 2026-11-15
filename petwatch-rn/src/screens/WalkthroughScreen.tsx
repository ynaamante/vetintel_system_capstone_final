import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, NativeScrollEvent, NativeSyntheticEvent, ScrollView, type ScrollViewInstance, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import TourIllustration from '../components/TourIllustration';
import { useOnboarding } from '../context/OnboardingContext';

const SLIDES = [
  { id: 'welcome', illustration: 'clinic', title: 'Welcome to VetIntel', subtitle: 'Your pet’s health, all in one place.', description: 'Easily manage pet records, track vaccinations, schedule appointments, and stay connected with veterinary care.' },
  { id: 'records', illustration: 'records', title: 'Track Health Records', subtitle: 'Every pet’s history, together.', description: 'Keep vaccinations and medical history organized for every pet, so you can follow their care with participating clinics.' },
  { id: 'appointments', illustration: 'calendar', title: 'Plan Veterinary Visits', subtitle: 'Appointments made easier.', description: 'Book and manage vet visits, check appointment details, and keep track of your pet’s upcoming care.' },
  { id: 'clinics', illustration: 'nearby', title: 'Find Nearby Clinics', subtitle: 'Find care close to home.', description: 'Explore nearby veterinary clinics, view their contact information, and get directions when your pet needs a visit.' },
  { id: 'guidance', illustration: 'guidance', title: 'Care with Confidence', subtitle: 'Helpful guidance, every day.', description: 'Browse practical pet-care tips and preventive-care guidance to help keep your dogs and cats healthy.' },
] as const;

function CardWaves() {
  return <View pointerEvents="none" style={styles.cardWaves} importantForAccessibility="no-hide-descendants"><Svg width="100%" height="100%" viewBox="0 0 320 95" preserveAspectRatio="none">
    <Path d="M0 38 C77 35 98 89 166 71 C232 52 250 24 320 33 V95 H0 Z" fill="#D4EEE2" />
    <Path d="M0 53 C79 52 102 100 178 78 C239 59 275 50 320 53 V95 H0 Z" fill="#B7DEC9" />
    <Path d="M0 63 C69 59 104 99 170 88 C242 76 275 58 320 66 V95 H0 Z" fill="#8FCCAA" opacity={0.8}/>
    <G fill="#80C4A2" opacity={0.32}><Ellipse cx="254" cy="42" rx="7" ry="11" rotation="-25" origin="254,42"/><Ellipse cx="270" cy="29" rx="7" ry="11"/><Ellipse cx="286" cy="31" rx="7" ry="11" rotation="18" origin="286,31"/><Ellipse cx="301" cy="47" rx="7" ry="10" rotation="30" origin="301,47"/><Path d="M258 65 C257 52 272 43 281 47 C292 50 299 65 290 73 C285 78 278 72 273 73 C265 76 258 73 258 65 Z"/></G>
  </Svg></View>;
}

export default function WalkthroughScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useOnboarding();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height - insets.top - insets.bottom < 700;
  const panelHeight = Math.max(360, Math.min(470, (height - insets.top - insets.bottom) * 0.62));
  const [current, setCurrent] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(Math.max(1, width - 28));
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const pager = useRef<ScrollViewInstance>(null);
  const currentRef = useRef(0);
  const reducedMotion = useRef(false);
  const progress = useSharedValue(1 / SLIDES.length);

  useEffect(() => { let active = true; AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reducedMotion.current = value; }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { pager.current?.scrollTo({ x: currentRef.current * pagerWidth, animated: false }); }, [pagerWidth]);
  const select = (index: number, scroll = true) => {
    const next = Math.max(0, Math.min(SLIDES.length - 1, index));
    currentRef.current = next; setCurrent(next);
    progress.value = withTiming((next + 1) / SLIDES.length, { duration: reducedMotion.current ? 0 : 280, easing: Easing.out(Easing.cubic) });
    if (scroll) pager.current?.scrollTo({ x: next * pagerWidth, animated: !reducedMotion.current });
  };
  const scrolled = (event: NativeSyntheticEvent<NativeScrollEvent>) => select(Math.round(event.nativeEvent.contentOffset.x / pagerWidth), false);
  const finish = async () => {
    if (leaving) return;
    setLeaving(true); setError('');
    try { await completeOnboarding(); }
    catch { setError('Unable to continue. Please try again.'); setLeaving(false); }
  };
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const first = current === 0, last = current === SLIDES.length - 1;

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { minHeight: height - insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to welcome" disabled={leaving} style={styles.headerButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Welcome')}><Ionicons name="arrow-back" size={17} color="#11654C"/><Text style={styles.headerText}>Back</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip quick tour" disabled={leaving} style={styles.headerButton} onPress={finish}><Text style={styles.headerText}>Skip</Text></TouchableOpacity>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: SLIDES.length, now: current + 1 }} accessibilityLabel="Quick tour progress"><Animated.View style={[styles.progressFill, progressStyle]}><LinearGradient colors={['#006D4D', '#6BBB60', '#006D4D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill}/></Animated.View></View>
        <Text style={styles.progressText}>{current + 1} / {SLIDES.length}</Text>
      </View>

      <View style={styles.pagerShell} onLayout={event => { const measured = event.nativeEvent.layout.width; if (measured > 0) setPagerWidth(measured); }}>
        <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={scrolled} scrollEnabled={!leaving} style={styles.pager}>
          {SLIDES.map(slide => <View key={slide.id} style={{ width: pagerWidth }} accessibilityElementsHidden={SLIDES[current].id !== slide.id} importantForAccessibility={SLIDES[current].id === slide.id ? 'auto' : 'no-hide-descendants'}>
            <LinearGradient colors={['#EAF6F1', '#F6FBF8']} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.card, { minHeight: panelHeight }]}>
              <View style={[styles.cardContent, compact && styles.cardContentCompact]}>
                <View style={styles.illustration}><TourIllustration kind={slide.illustration} width={compact ? 190 : 210}/></View>
                <Text accessibilityRole="header" style={[styles.title, width < 350 && styles.titleCompact]}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>
              <CardWaves/>
            </LinearGradient>
          </View>)}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>{SLIDES.map((slide, index) => <TouchableOpacity key={slide.id} accessibilityRole="button" accessibilityLabel={`Tour page ${index + 1}: ${slide.title}`} accessibilityState={{ selected: index === current }} disabled={leaving} hitSlop={6} style={styles.dotTouch} onPress={() => select(index)}><View style={[styles.dot, index === current && styles.dotActive]}/></TouchableOpacity>)}</View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.buttons}>
          <TouchableOpacity accessibilityRole="button" disabled={first || leaving} onPress={() => select(current - 1)} style={[styles.previous, first && styles.previousDisabled]}><Text style={[styles.previousText, first && styles.previousDisabledText]}>Previous</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={leaving} onPress={last ? finish : () => select(current + 1)} activeOpacity={0.85} style={styles.next}><LinearGradient colors={['#006C4F', '#6CB55C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextGradient}><Text style={styles.nextText}>{leaving ? 'Continuing…' : last ? 'Get Started' : 'Next'}</Text></LinearGradient></TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingTop: 4 },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 2 },
  headerText: { fontSize: 14, fontWeight: '600', color: '#11654C' },
  progressContainer: { marginBottom: 16 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#DCEBE3', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  progressText: { fontSize: 12, color: '#284D3E', textAlign: 'right', marginTop: 6, lineHeight: 16 },
  pagerShell: { width: '100%' },
  pager: { flexGrow: 0, flexShrink: 0 },
  card: { borderRadius: 24, overflow: 'hidden', flexGrow: 1 },
  cardContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 74, paddingHorizontal: 24 },
  cardContentCompact: { paddingTop: 12, paddingBottom: 65, paddingHorizontal: 20 },
  illustration: { marginBottom: 12 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center', color: '#064C3B', letterSpacing: -0.6 },
  titleCompact: { fontSize: 24, lineHeight: 29 },
  subtitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#0B6845', textAlign: 'center', marginTop: 6 },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center', color: '#1F332A', marginTop: 12, maxWidth: 330 },
  cardWaves: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  footer: { marginTop: 'auto', paddingTop: 20 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  dotTouch: { paddingVertical: 10, paddingHorizontal: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#CFE2D8' },
  dotActive: { backgroundColor: '#087654' },
  buttons: { flexDirection: 'row', gap: 12 },
  previous: { flex: 1, minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#A3CAB6', backgroundColor: '#E9F5EE', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  previousDisabled: { borderColor: '#C6E0D3', backgroundColor: '#C6E0D3' },
  previousText: { fontSize: 15, fontWeight: '600', color: '#17664B', textAlign: 'center' },
  previousDisabledText: { color: '#FFFFFF' },
  next: { flex: 1, borderRadius: 9, overflow: 'hidden' },
  nextGradient: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  nextText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  error: { color: '#A12F2F', textAlign: 'center', fontSize: 12, lineHeight: 18, marginBottom: 10 },
});
