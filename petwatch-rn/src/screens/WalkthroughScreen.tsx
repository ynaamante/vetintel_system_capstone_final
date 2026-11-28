import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Image, type ImageSourcePropType, type NativeScrollEvent,
  type NativeSyntheticEvent, ScrollView, type ScrollViewInstance, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useOnboarding } from '../context/OnboardingContext';
import { colors, gradients } from '../theme/colors';

type Crop = { x: number; y: number; width: number; height: number };
type TourSlide = {
  id: string;
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  hero: Crop;
  waves: Crop;
  background: string;
  title: string;
  subtitle: string;
  description: string;
};

const slides: TourSlide[] = [
  {
    id: 'welcome',
    source: require('../images/quick-tour/welcome.png'),
    sourceWidth: 941,
    sourceHeight: 1672,
    hero: { x: 0, y: 225, width: 941, height: 669 },
    waves: { x: 0, y: 1528, width: 941, height: 144 },
    background: colors.white,
    title: 'Welcome to VetIntel',
    subtitle: 'Your pet’s health, all in one place.',
    description: 'Easily manage pet records, track vaccinations, schedule appointments, and stay connected with veterinary care.',
  },
  {
    id: 'records',
    source: require('../images/quick-tour/health-records.png'),
    sourceWidth: 858,
    sourceHeight: 1832,
    hero: { x: 0, y: 263, width: 858, height: 717 },
    waves: { x: 0, y: 1721, width: 858, height: 111 },
    background: '#F4FAF9',
    title: 'Track Health Records',
    subtitle: 'Every pet’s history, together.',
    description: 'Keep vaccinations and medical history organized for every pet, so you can follow their care with participating clinics.',
  },
  {
    id: 'appointments',
    source: require('../images/quick-tour/veterinary-visits.png'),
    sourceWidth: 941,
    sourceHeight: 1672,
    hero: { x: 0, y: 225, width: 941, height: 673 },
    waves: { x: 0, y: 1528, width: 941, height: 144 },
    background: colors.white,
    title: 'Plan Veterinary Visits',
    subtitle: 'Appointments made easier.',
    description: 'Book and manage vet visits, check appointment details, and keep track of your pet’s upcoming care.',
  },
  {
    id: 'clinics',
    source: require('../images/quick-tour/nearby-clinics.png'),
    sourceWidth: 858,
    sourceHeight: 1833,
    hero: { x: 0, y: 241, width: 858, height: 717 },
    waves: { x: 0, y: 1708, width: 858, height: 125 },
    background: '#F4FAF8',
    title: 'Find Nearby Clinics',
    subtitle: 'Find care close to home.',
    description: 'Explore nearby veterinary clinics, view their contact information, and get directions when your pet needs a visit.',
  },
  {
    id: 'guidance',
    source: require('../images/quick-tour/care-guidance.png'),
    sourceWidth: 941,
    sourceHeight: 1672,
    hero: { x: 0, y: 224, width: 941, height: 650 },
    waves: { x: 0, y: 1525, width: 941, height: 147 },
    background: '#F0F8F4',
    title: 'Care with Confidence',
    subtitle: 'Helpful guidance, every day.',
    description: 'Browse practical pet-care tips and preventive-care guidance to help keep your dogs and cats healthy.',
  },
];

const tourMaxWidth = 480;

function TourArtwork({ slide, crop, width }: { slide: TourSlide; crop: Crop; width: number }) {
  // Render only the photo or waves from the reference, with controls and copy in native views.
  const scale = width / crop.width;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.artwork, { height: crop.height * scale }]}
    >
      <Image
        source={slide.source}
        resizeMode="stretch"
        accessible={false}
        fadeDuration={0}
        style={{
          position: 'absolute',
          width: slide.sourceWidth * scale,
          height: slide.sourceHeight * scale,
          left: -crop.x * scale,
          top: -crop.y * scale,
        }}
      />
    </View>
  );
}

export default function WalkthroughScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useOnboarding();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(Math.max(1, Math.min(tourMaxWidth, width - insets.left - insets.right)));
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const pager = useRef<ScrollViewInstance>(null);
  const currentRef = useRef(0);
  const reducedMotion = useRef(false);
  const progress = useSharedValue(1 / slides.length);
  const active = slides[current];
  const first = current === 0;
  const last = current === slides.length - 1;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) reducedMotion.current = value;
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    pager.current?.scrollTo({ x: currentRef.current * pagerWidth, animated: false });
  }, [pagerWidth]);

  const select = (index: number, scroll = true) => {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    currentRef.current = next;
    setCurrent(next);
    progress.value = withTiming((next + 1) / slides.length, {
      duration: reducedMotion.current ? 0 : 280,
      easing: Easing.out(Easing.cubic),
    });
    if (scroll) pager.current?.scrollTo({ x: next * pagerWidth, animated: !reducedMotion.current });
  };

  const scrolled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    select(Math.round(event.nativeEvent.contentOffset.x / pagerWidth), false);
  };

  const finish = async () => {
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

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: active.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { minHeight: height - insets.top }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to welcome"
            disabled={leaving}
            style={styles.headerButton}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Welcome')}
          >
            <Ionicons name="arrow-back" size={21} color={colors.ink} />
            <Text style={styles.headerText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip quick tour" disabled={leaving} style={styles.headerButton} onPress={finish}>
            <Text style={styles.headerText}>Skip</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progress}>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: slides.length, now: current + 1 }}
            accessibilityLabel="Quick tour progress"
          >
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          <Text style={styles.progressText}>{current + 1} / {slides.length}</Text>
        </View>

        <View
          onLayout={event => {
            const measured = event.nativeEvent.layout.width;
            if (measured > 0) setPagerWidth(measured);
          }}
        >
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={scrolled}
            scrollEnabled={!leaving}
            style={styles.pager}
            contentContainerStyle={styles.pagerContent}
          >
            {slides.map((slide, index) => {
              const selected = index === current;
              return (
                <View
                  key={slide.id}
                  style={{ width: pagerWidth, backgroundColor: slide.background }}
                  accessibilityElementsHidden={!selected}
                  importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
                  aria-hidden={!selected}
                >
                  <TourArtwork slide={slide} crop={slide.hero} width={pagerWidth} />
                  <View style={styles.copy}>
                    <Text accessibilityRole="header" style={[styles.title, pagerWidth < 355 && styles.titleCompact]}>{slide.title}</Text>
                    <Text style={styles.subtitle}>{slide.subtitle}</Text>
                    <Text style={styles.description}>{slide.description}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((slide, index) => (
              <TouchableOpacity
                key={slide.id}
                accessibilityRole="button"
                accessibilityLabel={`Tour page ${index + 1}: ${slide.title}`}
                accessibilityState={{ selected: index === current }}
                disabled={leaving}
                style={styles.dotTouch}
                onPress={() => select(index)}
              >
                <View style={[styles.dot, index === current && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <View style={styles.buttons}>
            <TouchableOpacity accessibilityRole="button" disabled={first || leaving} onPress={() => select(current - 1)} style={styles.previous}>
              <Text style={[styles.previousText, first && styles.previousDisabledText]}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={leaving} onPress={last ? finish : () => select(current + 1)} activeOpacity={0.85} style={styles.next}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextGradient}>
                <Text style={styles.nextText}>{leaving ? 'Continuing…' : last ? 'Get Started' : 'Next'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        <TourArtwork slide={active} crop={active.waves} width={pagerWidth} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: tourMaxWidth, alignSelf: 'center', flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  headerText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  progress: { marginHorizontal: 20, marginTop: 9, marginBottom: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  progressText: { fontSize: 15, fontWeight: '700', color: colors.ink, textAlign: 'right', marginTop: 8, lineHeight: 20 },
  pager: { flexGrow: 0, flexShrink: 0 },
  pagerContent: { alignItems: 'flex-start' },
  artwork: { width: '100%', overflow: 'hidden' },
  copy: { alignItems: 'center', paddingHorizontal: 25, paddingTop: 14, gap: 10 },
  title: { fontSize: 29, lineHeight: 34, fontWeight: '800', textAlign: 'center', color: colors.ink, letterSpacing: -0.65 },
  titleCompact: { fontSize: 25, lineHeight: 29 },
  subtitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.ink, textAlign: 'center', backgroundColor: colors.primarySoft, borderRadius: 16, overflow: 'hidden', paddingVertical: 5, paddingHorizontal: 16 },
  description: { fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.text, maxWidth: 360 },
  footer: { marginTop: 'auto', paddingTop: 13, paddingHorizontal: 16, paddingBottom: 16 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  dotTouch: { minWidth: 19, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.sidebarBorder },
  dotActive: { backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: 11 },
  previous: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  previousText: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  previousDisabledText: { opacity: 0.68 },
  next: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  nextGradient: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  nextText: { color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.dangerText, textAlign: 'center', fontSize: 12, lineHeight: 18, marginBottom: 10 },
});
