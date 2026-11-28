import React, { useEffect } from 'react';
import { AccessibilityInfo, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';

const LOGO_MARK = require('../images/LogoMark.png');
const LOGO_WORDMARK = require('../images/LogoWordmarkTagline.png');
// Centerline sampled from LogoMark.png in its own 1560 x 1240 coordinates.
// Keep every tracing layer narrower than the existing green ring.
const RING_POINTS = [[215,610],[216.4,570.6],[220,531.3],[226.4,492.3],[235.9,454],[247.7,416.2],[263.4,380],[280.7,344.5],[300.4,310.3],[322.5,277.6],[346.4,246.2],[372.9,216.8],[401.6,189.8],[431.5,164],[463.2,140.4],[496.7,119.4],[531.9,101.3],[568,85.2],[605.3,72.2],[643.1,60.8],[681.8,53.1],[720.9,48.1],[760.3,45.8],[799.7,45.8],[838.9,49.6],[877.9,55.1],[916.1,64.2],[953.5,76],[990,90.3],[1025.7,106.2],[1059.3,126.3]];
const RING_PATH = RING_POINTS.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.join(' ')).join(' ');
const RING_LENGTH = RING_POINTS.reduce((length, point, index) => index === 0 ? 0 : length + Math.hypot(point[0] - RING_POINTS[index - 1][0], point[1] - RING_POINTS[index - 1][1]), 0);
const PULSE_POINTS = [[2, 18], [43, 18], [54, 8], [64, 28], [75, 14], [84, 18], [112, 18], [122, 12], [133, 18], [178, 18]];
const PULSE_LENGTH = PULSE_POINTS.reduce((length, point, index) => index === 0 ? 0 : length + Math.hypot(point[0] - PULSE_POINTS[index - 1][0], point[1] - PULSE_POINTS[index - 1][1]), 0);
const PULSE_LINE = PULSE_POINTS.map(point => point.join(',')).join(' ');
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

export default function SplashScreen() {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const markWidth = Math.min(width * 0.64, height * 0.34, 245);
  const wordmarkWidth = Math.min(width * 0.68, 260);
  const wordmarkHeight = wordmarkWidth * 475 / 1560;
  const logoProgress = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const wordmarkProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active) return;
      if (reduced) {
        logoProgress.value = 1; ringProgress.value = 1; wordmarkProgress.value = 1; pulseProgress.value = 1;
        return;
      }
      logoProgress.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
      ringProgress.value = withDelay(250, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }));
      wordmarkProgress.value = withDelay(550, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      pulseProgress.value = withDelay(1050, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }));
    }).catch(() => {
      if (active) { logoProgress.value = 1; ringProgress.value = 1; wordmarkProgress.value = 1; pulseProgress.value = 1; }
    });
    const timer = setTimeout(() => navigation.replace('Welcome'), 2500);
    return () => { active = false; clearTimeout(timer); };
  }, [navigation, logoProgress, ringProgress, wordmarkProgress, pulseProgress]);

  const markStyle = useAnimatedStyle(() => ({ opacity: logoProgress.value, transform: [{ scale: 0.92 + 0.08 * logoProgress.value }] }));
  const wordmarkStyle = useAnimatedStyle(() => ({ opacity: wordmarkProgress.value, transform: [{ translateY: 10 * (1 - wordmarkProgress.value) }] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pulseProgress.value * 5) }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - ringProgress.value),
    opacity: Math.min(1, ringProgress.value * 10) * Math.min(1, (1 - ringProgress.value) * 8),
  }));
  const ringHaloProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - ringProgress.value),
    opacity: Math.min(1, ringProgress.value * 10) * Math.min(1, (1 - ringProgress.value) * 8) * 0.24,
  }));
  const ringHeadProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (0.12 - ringProgress.value),
    opacity: Math.min(1, ringProgress.value * 10) * Math.min(1, (1 - ringProgress.value) * 8),
  }));
  const pulseProps = useAnimatedProps(() => ({ strokeDashoffset: PULSE_LENGTH * (1 - pulseProgress.value) }));
  const pulseHighlightProps = useAnimatedProps(() => ({ strokeDashoffset: -PULSE_LENGTH * pulseProgress.value, opacity: Math.sin(Math.PI * pulseProgress.value) * 0.8 }));

  return <View style={styles.container}>
    <StatusBar style="dark" />
    <View pointerEvents="none" style={styles.waves} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 390 150" preserveAspectRatio="none">
        <Path d="M0 56 C58 70 85 120 153 119 C232 118 278 42 390 28 L390 150 L0 150 Z" fill={colors.hoverBand} />
        <Path d="M0 100 C58 74 105 94 163 120 C229 150 281 106 390 72 L390 150 L0 150 Z" fill={colors.primarySoft} />
        <Path d="M0 125 C75 101 117 123 180 140 C257 161 325 112 390 103 L390 150 L0 150 Z" fill={colors.bannerEnd} opacity={0.75} />
      </Svg>
    </View>

    <View style={[styles.centerAnchor, { height: wordmarkHeight, transform: [{ translateY: -wordmarkHeight * 0.39 }] }]} accessible accessibilityLabel="Vetintel is loading">
      <Animated.View style={[styles.markStage, { width: markWidth, bottom: wordmarkHeight + 24 }, markStyle]}>
        <Image source={LOGO_MARK} style={styles.image} resizeMode="contain" />
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 1560 1240">
          <AnimatedPath d={RING_PATH} fill="none" strokeLinejoin="round" stroke={colors.primaryHover} strokeWidth={30} strokeLinecap="round" strokeDasharray={[RING_LENGTH, RING_LENGTH]} animatedProps={ringHaloProps} />
          <AnimatedPath d={RING_PATH} fill="none" strokeLinejoin="round" stroke={colors.primary} strokeWidth={19} strokeLinecap="round" strokeDasharray={[RING_LENGTH, RING_LENGTH]} animatedProps={ringProps} />
          <AnimatedPath d={RING_PATH} fill="none" strokeLinejoin="round" stroke={colors.chart2} strokeWidth={9} strokeLinecap="round" strokeDasharray={[RING_LENGTH * 0.12, RING_LENGTH]} animatedProps={ringHeadProps} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ width: wordmarkWidth, height: wordmarkHeight }, wordmarkStyle]}>
        <Image source={LOGO_WORDMARK} style={styles.image} resizeMode="contain" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.pulse, { width: Math.min(width * 0.46, 180), top: wordmarkHeight + 16 }, pulseStyle]}>
        <Svg width="100%" height={32} viewBox="0 0 180 36">
          <AnimatedPolyline points={PULSE_LINE} fill="none" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[PULSE_LENGTH, PULSE_LENGTH]} animatedProps={pulseProps} />
          <AnimatedPolyline points={PULSE_LINE} fill="none" stroke={colors.chart2} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[PULSE_LENGTH * 0.16, PULSE_LENGTH]} animatedProps={pulseHighlightProps} />
        </Svg>
      </Animated.View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  waves: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  // Anchor the wordmark, rather than the combined logo/wordmark stack, so the
  // Vetintel name stays at the visual center on both phone and web viewports.
  centerAnchor: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
  markStage: { position: 'absolute', aspectRatio: 1560 / 1240 },
  image: { width: '100%', height: '100%' },
  pulse: { position: 'absolute', height: 32 },
});
