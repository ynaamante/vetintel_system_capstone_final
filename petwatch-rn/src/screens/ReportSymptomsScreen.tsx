import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { mockPets } from '../data/mockData';

const SYMPTOMS = [
  { id: 'lethargy', label: 'Lethargy', icon: 'battery-dead-outline', risk: 2 },
  { id: 'vomiting', label: 'Vomiting', icon: 'warning-outline', risk: 3 },
  { id: 'diarrhea', label: 'Diarrhea', icon: 'alert-outline', risk: 3 },
  { id: 'loss_appetite', label: 'Loss of Appetite', icon: 'nutrition-outline', risk: 2 },
  { id: 'coughing', label: 'Coughing', icon: 'mic-off-outline', risk: 2 },
  { id: 'sneezing', label: 'Sneezing', icon: 'cloud-outline', risk: 1 },
  { id: 'scratching', label: 'Scratching', icon: 'hand-left-outline', risk: 1 },
  { id: 'limping', label: 'Limping', icon: 'walk-outline', risk: 3 },
  { id: 'discharge', label: 'Eye/Nose Discharge', icon: 'eye-outline', risk: 2 },
  { id: 'seizures', label: 'Seizures', icon: 'pulse-outline', risk: 5 },
  { id: 'difficulty_breathing', label: 'Difficulty Breathing', icon: 'fitness-outline', risk: 5 },
  { id: 'swelling', label: 'Swelling', icon: 'expand-outline', risk: 3 },
];

const DURATIONS = ['Less than 24 hours', '1-3 days', '3-7 days', 'More than a week'];

export default function ReportSymptomsScreen({ route, navigation }: any) {
  const { petId } = route.params || {};
  const { colors: tc, isDark } = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const s = styles(tc, isDark);
  const pet = route.params?.pet || mockPets.find(p => p.id === petId) || mockPets[0];

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const totalRisk = selected.reduce((sum, id) => {
    const sym = SYMPTOMS.find(s => s.id === id);
    return sum + (sym?.risk || 0);
  }, 0);

  const getRiskLevel = () => {
    if (totalRisk >= 8) return { label: 'High Risk', color: colors.dangerText, bg: colors.dangerBg, border: colors.danger };
    if (totalRisk >= 4) return { label: 'Moderate Risk', color: colors.warningText, bg: colors.warningBg, border: colors.warning };
    return { label: 'Low Risk', color: colors.successText, bg: colors.successBg, border: colors.success };
  };

  const submit = () => {
    if (selected.length === 0) { Toast.show({ type: 'error', text1: 'Select at least one symptom' }); return; }
    if (!duration) { Toast.show({ type: 'error', text1: 'Select symptom duration' }); return; }
    Toast.show({ type: 'success', text1: 'Symptoms reported!', text2: 'Your vet has been notified.' });
    navigation.goBack();
  };

  const risk = selected.length > 0 ? getRiskLevel() : null;

  return (
    <SafeAreaView style={s.safe}>
      <AppHeader title="Report Symptoms" />
      <ScrollView style={s.panel} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.petBadge}>
          <Ionicons name="paw" size={16} color={colors.primary} />
          <Text style={s.petBadgeText}>Reporting for: <Text style={{ fontWeight: '700' }}>{pet.name}</Text></Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Select Symptoms</Text>
          <Text style={s.hint}>Tap all symptoms you've observed</Text>
          <View style={s.symptomsGrid}>
            {SYMPTOMS.map(sym => {
              const active = selected.includes(sym.id);
              return (
                <TouchableOpacity key={sym.id} style={[s.symBtn, active && s.symBtnActive]} onPress={() => toggle(sym.id)}>
                  <Ionicons name={sym.icon as any} size={20} color={active ? colors.primary : tc.textSecondary} />
                  <Text style={[s.symLabel, active && { color: colors.primary }]}>{sym.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ position: 'absolute', top: 6, right: 6 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {risk && (
          <View style={[s.riskCard, { backgroundColor: risk.bg, borderColor: risk.border }]}>
            <Ionicons name="shield-outline" size={20} color={risk.color} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[s.riskLabel, { color: risk.color }]}>{risk.label}</Text>
              <Text style={[s.riskSub, { color: risk.color }]}>{selected.length} symptom{selected.length !== 1 ? 's' : ''} selected</Text>
            </View>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.sectionTitle}>Duration</Text>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d} style={[s.durationBtn, duration === d && s.durationBtnActive]} onPress={() => setDuration(d)}>
              <Ionicons name={duration === d ? 'radio-button-on' : 'radio-button-off'} size={18} color={duration === d ? colors.primary : tc.textMuted} />
              <Text style={[s.durationText, duration === d && { color: colors.primary }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Additional Notes</Text>
          <TextInput style={[s.input, { height: 90, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Describe any other observations..." placeholderTextColor={tc.textMuted} multiline />
        </View>

        <TouchableOpacity style={s.btn} onPress={submit}>
          <Ionicons name="send" size={18} color={colors.white} />
          <Text style={s.btnText}>Submit Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  panel: { ...roundedScreenPanel, backgroundColor: tc.background },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: tc.text },
  container: { padding: spacing.md, paddingBottom: 40 },
  petBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? colors.primarySoftDark : colors.primarySoft, borderRadius: radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: isDark ? colors.primary : colors.border },
  petBadgeText: { fontSize: 14, color: isDark ? colors.chart2 : colors.ink },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: tc.border },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: tc.text, marginBottom: 4 },
  hint: { fontSize: 13, color: tc.textMuted, marginBottom: 14 },
  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symBtn: { width: '47%', borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, alignItems: 'center', gap: 6, position: 'relative' },
  symBtnActive: { borderColor: colors.primary, backgroundColor: isDark ? colors.primarySoftDark : colors.primarySoft },
  symLabel: { fontSize: 12, color: tc.textSecondary, textAlign: 'center' },
  riskCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: 14, marginBottom: 14, borderWidth: 1 },
  riskLabel: { fontSize: 15, fontWeight: '700' },
  riskSub: { fontSize: 13 },
  durationBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border },
  durationBtnActive: {},
  durationText: { fontSize: 14, color: tc.text },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, marginBottom: 10 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
