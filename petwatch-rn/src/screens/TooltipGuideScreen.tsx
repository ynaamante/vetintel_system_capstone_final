import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useOnboarding } from '../context/OnboardingContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Tooltip {
  id: number;
  title: string;
  description: string;
  tips: string[];
  icon: string;
}

const tooltips: Tooltip[] = [
  {
    id: 1,
    title: 'Dashboard overview',
    description: 'Your home screen shows everything important about your pets at a glance.',
    icon: '📊',
    tips: ['Quick access to health alerts', 'View all your pets', 'Upcoming appointments', 'Important notifications'],
  },
  {
    id: 2,
    title: 'Pet profiles',
    description: 'Create and manage a detailed profile for each of your pets.',
    icon: '🐾',
    tips: ['Add multiple pets', 'Store pet photos', 'Track breed information', 'Record birth dates'],
  },
  {
    id: 3,
    title: 'Health records',
    description: 'Keep all medical information organized in one secure place.',
    icon: '📁',
    tips: ['Upload vaccination records', 'Store medical reports', 'Track medical history', 'Share with vets'],
  },
  {
    id: 4,
    title: 'Quick tips',
    description: 'Access expert advice and best practices for everyday pet care.',
    icon: '💡',
    tips: ['Nutrition guides', 'Exercise recommendations', 'Preventive care tips', 'Emergency guidelines'],
  },
];

export default function TooltipGuideScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useOnboarding();
  const [expandedId, setExpandedId] = useState(0);
  const [completedItems, setCompletedItems] = useState<number[]>([]);

  const progress = useSharedValue(0);
  const completionPercentage = (completedItems.length / tooltips.length) * 100;

  React.useEffect(() => {
    progress.value = withTiming(completionPercentage / 100, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [completionPercentage]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const handleComplete = async () => {
    // Completing onboarding will trigger navigation update
    await completeOnboarding();
  };

  const toggleExpanded = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? -1 : id);
  };

  const toggleCompleted = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCompletedItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick tips &amp; tricks</Text>
        <Text style={styles.subtitle}>Learn how to make the most of Vetintel</Text>
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Your progress</Text>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View style={[styles.progressBarFill, progressStyle]} />
          </View>
          <Text style={styles.progressPercent}>{Math.round(completionPercentage)}%</Text>
        </View>
        <Text style={styles.progressItems}>
          {completedItems.length} of {tooltips.length} tips read
        </Text>
      </View>

      <View style={styles.tooltipsContainer}>
        {tooltips.map((tooltip) => {
          const isExpanded = expandedId === tooltip.id;
          const isCompleted = completedItems.includes(tooltip.id);

          return (
            <View key={tooltip.id} style={styles.tooltipWrapper}>
              <TouchableOpacity
                style={[
                  styles.tooltipHeader,
                  isExpanded && styles.tooltipHeaderExpanded,
                  isCompleted && styles.tooltipHeaderCompleted,
                ]}
                onPress={() => toggleExpanded(tooltip.id)}
                activeOpacity={0.7}
              >
                <View style={styles.tooltipHeaderContent}>
                  <Text style={styles.tooltipIcon}>{tooltip.icon}</Text>
                  <View style={styles.tooltipTitleContainer}>
                    <Text style={styles.tooltipTitle}>{tooltip.title}</Text>
                    <Text style={styles.tooltipDescription} numberOfLines={1}>
                      {tooltip.description}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.expandIcon, isCompleted && { color: colors.success }]}>
                  {isCompleted ? '✓' : isExpanded ? '−' : '+'}
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.tooltipContent}>
                  <Text style={styles.tooltipFullDescription}>{tooltip.description}</Text>

                  <View style={styles.tipsList}>
                    <Text style={styles.tipsTitle}>Key features</Text>
                    {tooltip.tips.map((tip, index) => (
                      <View key={index} style={styles.tipItem}>
                        <Text style={styles.tipBullet}>•</Text>
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.checkButton, isCompleted && styles.checkButtonCompleted]}
                    onPress={() => toggleCompleted(tooltip.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.checkButtonText, isCompleted && { color: colors.success }]}>
                      {isCompleted ? '✓ Got it' : 'Mark as read'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleComplete}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Maybe later</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleComplete} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Get started</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.slateLight,
  },
  progressCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slateLight,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: colors.fog,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.teal,
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    minWidth: 32,
  },
  progressItems: {
    fontSize: 12,
    color: colors.slateLight,
  },
  tooltipsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  tooltipWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.fog,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.paper,
  },
  tooltipHeaderExpanded: {
    backgroundColor: colors.cloud,
    borderBottomWidth: 1,
    borderBottomColor: colors.fog,
  },
  tooltipHeaderCompleted: {
    backgroundColor: colors.successBg,
  },
  tooltipHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tooltipIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  tooltipTitleContainer: {
    flex: 1,
  },
  tooltipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 2,
  },
  tooltipDescription: {
    fontSize: 13,
    color: colors.slateLight,
  },
  expandIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 12,
  },
  tooltipContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.white,
  },
  tooltipFullDescription: {
    fontSize: 14,
    color: colors.slate,
    lineHeight: 20,
    marginBottom: 16,
  },
  tipsList: {
    marginBottom: 16,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: colors.slate,
    lineHeight: 18,
  },
  checkButton: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.cloud,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.fog,
  },
  checkButtonCompleted: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  checkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButton: {
    backgroundColor: colors.cloud,
    borderWidth: 1,
    borderColor: colors.fog,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slateLight,
  },
});