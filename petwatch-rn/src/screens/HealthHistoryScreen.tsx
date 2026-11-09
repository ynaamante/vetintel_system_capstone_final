import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { mockPets } from '../data/mockData';

const MOCK_HISTORY = [
  { id: '1', date: '2026-05-20', symptoms: ['Lethargy', 'Loss of Appetite'], severity: 'moderate', notes: 'Pet seemed tired and refused breakfast. Resolved after 2 days.', resolved: true },
  { id: '2', date: '2026-04-10', symptoms: ['Vomiting', 'Diarrhea'], severity: 'high', notes: 'Suspected food intolerance. Vet prescribed bland diet.', resolved: true },
  { id: '3', date: '2026-03-05', symptoms: ['Sneezing', 'Eye Discharge'], severity: 'low', notes: 'Mild seasonal allergies.', resolved: true },
  { id: '4', date: '2026-02-18', symptoms: ['Scratching', 'Skin Irritation'], severity: 'low', notes: 'Allergic reaction to new shampoo.', resolved: true },
  { id: '5', date: '2026-01-30', symptoms: ['Limping'], severity: 'moderate', notes: 'Sprained paw during play. Healed within a week.', resolved: true },
];

type Sev = 'all' | 'high' | 'moderate' | 'low';
const sevColor: Record<string, any> = {
  high: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: colors.danger },
  moderate: { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', dot: colors.warning },
  low: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', dot: colors.primary },
};

export default function HealthHistoryScreen({ route, navigation }: any) {
  const { petId } = route.params || {};
  const { colors: tc, isDark } = useTheme();
  const [filter, setFilter] = useState<Sev>('all');
  const s = styles(tc, isDark);
  const pet = mockPets.find(p => p.id === petId) || mockPets[0];
  const shown = filter === 'all' ? MOCK_HISTORY : MOCK_HISTORY.filter(h => h.severity === filter);

  const Card = ({ item }: { item: typeof MOCK_HISTORY[0] }) => {
    const sc = sevColor[item.severity];
    return (
      <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: sc.dot }]}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.date}>{format(parseISO(item.date), 'MMMM dd, yyyy')}</Text>
            <View style={s.sympRow}>
              {item.symptoms.map(sym => (
                <View key={sym} style={s.symTag}><Text style={s.symTagText}>{sym}</Text></View>
              ))}
            </View>
          </View>
          <View style={[s.sevBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[s.sevText, { color: sc.text }]}>{item.severity}</Text>
          </View>
        </View>
        {item.notes && <Text style={s.notes}>{item.notes}</Text>}
        <View style={s.resolvedRow}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={s.resolvedText}>Resolved</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={tc.text} /></TouchableOpacity>
        <Text style={s.navTitle}>Health History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.petBadge}>
        <Ionicons name="paw" size={16} color={colors.primary} />
        <Text style={s.petBadgeText}>{pet.name}'s symptom history</Text>
        <Text style={s.histCount}>{MOCK_HISTORY.length} records</Text>
      </View>

      <View style={s.filterRow}>
        {(['all', 'high', 'moderate', 'low'] as Sev[]).map(f => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="time-outline" size={48} color={tc.textMuted} />
            <Text style={s.emptyText}>No records for this filter</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: tc.text },
  petBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF', padding: 12, margin: spacing.md, marginBottom: 0, borderRadius: radius.md, borderWidth: 1, borderColor: isDark ? '#2563EB' : '#BFDBFE' },
  petBadgeText: { fontSize: 14, color: isDark ? '#93C5FD' : '#1E40AF', fontWeight: '500', flex: 1 },
  histCount: { fontSize: 13, color: isDark ? '#D2E5DC' : '#087A70', fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 14 },
  filterBtn: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: tc.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: tc.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  date: { fontSize: 14, fontWeight: '600', color: tc.text, marginBottom: 8 },
  sympRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  symTag: { backgroundColor: tc.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  symTagText: { fontSize: 12, color: tc.textSecondary },
  sevBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  sevText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  notes: { fontSize: 13, color: tc.textSecondary, marginBottom: 10, lineHeight: 18 },
  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resolvedText: { fontSize: 12, color: colors.success, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginTop: 12 },
});
