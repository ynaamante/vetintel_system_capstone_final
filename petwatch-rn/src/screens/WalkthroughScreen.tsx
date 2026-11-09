import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  type ScrollViewInstance,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useOnboarding } from '../context/OnboardingContext';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'Welcome to Vetintel',
    description: "Your all-in-one pet health companion. Track vaccinations, records, and appointments in one place.",
    icon: '🏥',
    color: colors.blue,
  },
  {
    id: 2,
    title: 'Track health records',
    description: 'Keep vaccination certificates, medical reports, and history organized for every pet.',
    icon: '📋',
    color: colors.teal,
  },
  {
    id: 3,
    title: 'Schedule appointments',
    description: 'Book and manage vet visits with reminders, so you never miss a checkup.',
    icon: '📅',
    color: colors.violet,
  },
  {
    id: 4,
    title: 'Find nearby clinics',
    description: 'Discover veterinary clinics near you, with directions, contact info, and reviews.',
    icon: '📍',
    color: '#14B8A6',
  },
  {
    id: 5,
    title: 'Get expert tips',
    description: 'A library of pet care guidance and nutrition advice from veterinary professionals.',
    icon: '💡',
    color: '#F59E0B',
  },
];

export default function WalkthroughScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useOnboarding();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const progressWidth = useSharedValue(1 / slides.length);

  const goToSlide = (index: number, animated = true) => {
    scrollRef.current?.scrollTo({ x: index * width, animated });
    setCurrentSlide(index);
    progressWidth.value = withTiming((index + 1) / slides.length, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== currentSlide) {
      setCurrentSlide(index);
      progressWidth.value = withTiming((index + 1) / slides.length, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    }
  };

  const handleSkip = async () => {
    // Completing onboarding will trigger navigation update
    await completeOnboarding();
  };

  const handleFinish = async () => {
    // Completing onboarding will trigger navigation update
    await completeOnboarding();
  };

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  const isFirst = currentSlide === 0;
  const isLast = currentSlide === slides.length - 1;
  const activeColor = slides[currentSlide].color;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} hitSlop={8}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, progressStyle, { backgroundColor: activeColor }]} />
        </View>
        <Text style={styles.progressText}>{currentSlide + 1} / {slides.length}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={[styles.slide, { width }]}>
            <View style={[styles.slideContent, { backgroundColor: `${slide.color}14` }]}>
              <View style={[styles.iconContainer, { backgroundColor: `${slide.color}1F` }]}>
                <Text style={styles.icon}>{slide.icon}</Text>
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsContainer}>
        {slides.map((slide, index) => (
          <TouchableOpacity key={slide.id} onPress={() => goToSlide(index)} hitSlop={6}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentSlide ? slide.color : colors.fog,
                  width: index === currentSlide ? 22 : 8,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.outlineButton, isFirst && styles.buttonDisabled]}
          onPress={() => !isFirst && goToSlide(currentSlide - 1)}
          disabled={isFirst}
        >
          <Text style={styles.outlineButtonText}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.solidButton, { backgroundColor: activeColor }]}
          onPress={isLast ? handleFinish : () => goToSlide(currentSlide + 1)}
        >
          <Text style={styles.solidButtonText}>{isLast ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  skipButton: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mist,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.fog,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.mist,
    textAlign: 'right',
  },
  pager: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  slideContent: {
    flex: 1,
    minHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderRadius: 22,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 15,
    color: colors.slateLight,
    lineHeight: 22,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    backgroundColor: colors.cloud,
    borderWidth: 1,
    borderColor: colors.fog,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slateLight,
  },
  solidButton: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  solidButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
