import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ownerCareApi } from '../services/api';
import { colors } from '../theme/colors';
import type { OwnerMedicalRecord } from '../utils/medicalActivity';
import { dateLabel } from '../utils/ownerCare';

type Props = {
  route: { params?: { petId: string; recordKey: string } };
};

export default function HealthRecordDetailsScreen({ route }: Props) {
  const { token } = useAuth();
  const { colors: theme, isDark } = useTheme();
  const { petId, recordKey } = route.params ?? {};
  const [details, setDetails] = useState<{ petName: string; record: OwnerMedicalRecord }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const headingColor = isDark ? theme.text : colors.ink;

  useFocusEffect(useCallback(() => {
    setDetails(undefined);
    setError('');
    if (!token || !petId || !recordKey) {
      setError('Open a record from your pet’s Health Report.');
      return;
    }

    let active = true;
    void ownerCareApi.medicalActivity(petId, token).then(activity => {
      if (!active) return;
      const record = activity.records.find(item => item.key === recordKey);
      if (record) setDetails({ petName: activity.petName, record });
      else setError('This record is no longer available in your pet’s Health Report.');
    }).catch(() => {
      if (active) setError('Unable to load this medical record.');
    });
    return () => { active = false; };
  }, [token, petId, recordKey, attempt]));

  const record = details?.record;
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <AppHeader title="Medical Record" compact />
      <ScrollView style={[roundedScreenPanel, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.message}>
            <Text accessibilityRole="alert" style={{ color: theme.text }}>{error}</Text>
            {!!petId && !!recordKey && !!token && (
              <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : !record ? (
          <View style={styles.message}>
            <ActivityIndicator color={colors.primary} />
            <Text accessibilityLiveRegion="polite" style={{ color: theme.textMuted }}>Loading medical record…</Text>
          </View>
        ) : (
          <>
            <View style={card}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{record.category}</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: headingColor }]}>{record.title}</Text>
              <Text style={[styles.value, { color: theme.text }]}>{[details?.petName, record.clinicName].filter(Boolean).join(' · ')}</Text>
              {(record.sharedAt || record.date) && (
                <Text style={[styles.label, { color: theme.textMuted }]}>
                  {record.origin === 'shared' || record.dateIsShared ? 'Shared ' : ''}{dateLabel(record.sharedAt || record.date || '')}
                </Text>
              )}
              {!!record.status && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{record.status}</Text>
                </View>
              )}
            </View>
            {record.sections?.length ? record.sections.map(group => (
              <View key={group.title} style={card}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: headingColor }]}>{group.title}</Text>
                {group.fields.map((field, index) => (
                  <View key={`${field.label}-${index}`} style={[styles.field, { borderTopColor: theme.border }]}>
                    <Text style={[styles.label, { color: theme.textMuted }]}>{field.label}</Text>
                    <Text selectable style={[styles.value, { color: theme.text }]}>{field.value}</Text>
                  </View>
                ))}
              </View>
            )) : (
              <View style={card}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: headingColor }]}>
                  {record.origin === 'shared' ? 'Doctor update' : 'Record details'}
                </Text>
                <Text selectable style={[styles.value, { color: theme.text }]}>{record.detail || 'No additional details recorded.'}</Text>
                {!!record.verifiedBy && <Text style={[styles.label, { color: theme.textMuted }]}>Verified by {record.verifiedBy}</Text>}
              </View>
            )}
            {record.origin === 'shared' && !!record.sharedBy && (
              <Text style={[styles.source, { color: theme.textMuted }]}>Shared by {record.sharedBy}</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  value: { fontSize: 15, lineHeight: 22 },
  field: { borderTopWidth: 1, paddingTop: 8, gap: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primarySoft },
  badgeText: { color: colors.ink, fontWeight: '600', textTransform: 'capitalize' },
  source: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  message: { alignItems: 'center', padding: 24, gap: 12 },
  retry: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', minHeight: 44 },
  retryText: { color: colors.white, fontWeight: '600' },
});
