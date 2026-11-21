import AppHeader from '../components/AppHeader';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ownerSharedRecordsApi } from '../services/api';
import { colors, spacing, radius } from '../theme/colors';
import { mockPets, mockVaccinations, Vaccination } from '../data/mockData';

type SharedVaccination = {
  id: string;
  title: string;
  detail: string;
  date?: string;
  clinicVerified?: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  clinicName: string;
};

type SharedRecordBundle = {
  petName?: string;
  clinicName?: string;
  records?: Array<{
    id: string;
    category: string;
    title: string;
    detail: string;
    date?: string;
    clinicVerified?: boolean;
    verifiedBy?: string | null;
    verifiedAt?: string | null;
  }>;
};

export default function VaccinationsScreen({ route, navigation }: any) {
  const { petId } = route.params || {};
  const { colors: tc, isDark } = useTheme();
  const { token } = useAuth();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ vaccine: '', date: '', nextDue: '', vetName: '' });
  const [sharedVaccinations, setSharedVaccinations] = useState<SharedVaccination[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedError, setSharedError] = useState('');
  const [sharedRetry, setSharedRetry] = useState(0);
  const s = styles(tc, isDark);
  const pet = route.params?.pet || mockPets.find(p => p.id === petId) || mockPets[0];
  const vacs = route.params?.pet ? [] : mockVaccinations.filter(v => v.petId === petId);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let active = true;
    if (!token) {
      setSharedVaccinations([]);
      setSharedLoading(false);
      setSharedError('Sign in to view vaccination records shared by your clinic.');
      return () => { active = false; };
    }
    setSharedLoading(true);
    setSharedError('');
    ownerSharedRecordsApi.list(token)
      .then((bundles: SharedRecordBundle[]) => {
        if (!Array.isArray(bundles)) throw new Error('The shared vaccination records response was not valid.');
        if (active) {
          setSharedVaccinations(bundles
            .filter(bundle => bundle.petName?.trim().toLowerCase() === pet.name.trim().toLowerCase())
            .flatMap(bundle => (Array.isArray(bundle.records) ? bundle.records : [])
              .filter(record => record.category === 'Vaccine')
              .map(record => ({ ...record, clinicName: bundle.clinicName || 'Your clinic' }))));
        }
      })
      .catch((error: Error) => {
        if (active) setSharedError(error.message || 'Unable to load clinic-shared vaccination records.');
      })
      .finally(() => {
        if (active) setSharedLoading(false);
      });
    return () => { active = false; };
  }, [token, pet.name, sharedRetry]);

  const getStatus = (vac: Vaccination) => {
    const days = differenceInDays(parseISO(vac.nextDue), new Date());
    if (days < 0) return { label: 'Overdue', color: colors.danger, bg: '#FEF2F2', border: '#FECACA' };
    if (days <= 30) return { label: `Due in ${days}d`, color: colors.warning, bg: '#FFF7ED', border: '#FED7AA' };
    return { label: 'Up to date', color: colors.success, bg: '#F0FDF4', border: '#BBF7D0' };
  };

  const save = () => {
    if (!form.vaccine || !form.date) { Toast.show({ type: 'error', text1: 'Vaccine name and date required' }); return; }
    Toast.show({ type: 'success', text1: 'Vaccination record added!' });
    setModal(false);
    setForm({ vaccine: '', date: '', nextDue: '', vetName: '' });
  };

  const Card = ({ item }: { item: Vaccination }) => {
    const st = getStatus(item);
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={[s.iconCircle, { backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF' }]}>
            <Ionicons name="medical" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.vacName}>{item.vaccine}</Text>
            <Text style={s.vetName}>{item.vetName}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <View style={s.dateRow}>
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Administered</Text>
            <Text style={s.dateVal}>{format(parseISO(item.date), 'MMM dd, yyyy')}</Text>
          </View>
          <View style={s.dateDivider} />
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Next Due</Text>
            <Text style={[s.dateVal, { color: st.color }]}>{format(parseISO(item.nextDue), 'MMM dd, yyyy')}</Text>
          </View>
        </View>
        {item.notes && <Text style={s.notes}>{item.notes}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <AppHeader title="Vaccinations" /><TouchableOpacity accessibilityLabel="Add vaccination" style={s.addBtn} onPress={() => setModal(true)}><Ionicons name="add" size={24} color={colors.primary} /></TouchableOpacity>

      <View style={s.petBadge}>
        <Ionicons name="paw" size={16} color={colors.primary} />
        <Text style={s.petBadgeText}>{pet.name}'s vaccination records</Text>
      </View>

      <FlatList
        data={vacs}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={s.sharedSection}>
            <View style={s.sharedHeading}>
              <Text style={s.sharedTitle}>Shared by your clinic</Text>
              {sharedError ? <TouchableOpacity onPress={() => setSharedRetry(value => value + 1)}><Text style={s.retryText}>Retry</Text></TouchableOpacity> : null}
            </View>
            {sharedLoading ? <Text style={s.sharedHint}>Loading clinic-shared records…</Text>
              : sharedError ? <Text style={s.sharedHint}>{sharedError}</Text>
                : sharedVaccinations.length ? sharedVaccinations.map(item => (
                  <View key={item.id} style={s.sharedCard}>
                    <View style={s.sharedCardHeading}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacName}>{item.title}</Text>
                        <Text style={s.vetName}>{item.clinicName}</Text>
                      </View>
                      <View style={s.verifiedBadge}>
                        <Ionicons name={item.clinicVerified ? 'shield-checkmark' : 'checkmark-circle'} size={13} color={item.clinicVerified ? '#087f65' : '#56758a'} />
                        <Text style={[s.verifiedBadgeText, !item.clinicVerified && s.sharedBadgeText]}>{item.clinicVerified ? 'Clinic Verified' : 'Shared by Clinic'}</Text>
                      </View>
                    </View>
                    <Text style={s.sharedDetail}>{item.detail}</Text>
                    {item.date ? <Text style={s.sharedDate}>{new Date(item.date).toLocaleDateString()}</Text> : null}
                    {item.clinicVerified && item.verifiedBy ? <Text style={s.verifiedBy}>Verified by {item.verifiedBy}{item.verifiedAt ? ` · ${new Date(item.verifiedAt).toLocaleDateString()}` : ''}</Text> : null}
                  </View>
                )) : <Text style={s.sharedHint}>Your clinic has not shared any vaccination records for {pet.name} yet.</Text>}
          </View>
        }
        ListEmptyComponent={sharedVaccinations.length ? null : (
          <View style={s.empty}>
            <Ionicons name="medical-outline" size={48} color={tc.textMuted} />
            <Text style={s.emptyText}>No vaccination records</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setModal(true)}>
              <Text style={s.primaryBtnText}>Add Record</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Add Vaccination Record</Text>
            <Text style={s.label}>Vaccine Name *</Text>
            <TextInput style={s.input} value={form.vaccine} onChangeText={v => set('vaccine', v)} placeholder="e.g. Rabies" placeholderTextColor={tc.textMuted} />
            <Text style={s.label}>Date Administered * (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={form.date} onChangeText={v => set('date', v)} placeholder="2026-01-15" placeholderTextColor={tc.textMuted} />
            <Text style={s.label}>Next Due Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={form.nextDue} onChangeText={v => set('nextDue', v)} placeholder="2027-01-15" placeholderTextColor={tc.textMuted} />
            <Text style={s.label}>Veterinarian</Text>
            <TextInput style={s.input} value={form.vetName} onChangeText={v => set('vetName', v)} placeholder="Dr. Smith" placeholderTextColor={tc.textMuted} />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.outlineBtn} onPress={() => setModal(false)}><Text style={s.outlineBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={save}><Text style={s.primaryBtnText}>Save Record</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: tc.text },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  petBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF', padding: 12, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: isDark ? '#2563EB' : '#BFDBFE' },
  petBadgeText: { fontSize: 14, color: isDark ? '#93C5FD' : '#1E40AF', fontWeight: '500' },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: tc.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  vacName: { fontSize: 15, fontWeight: '700', color: tc.text },
  vetName: { fontSize: 13, color: tc.textSecondary, marginTop: 2 },
  badge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', backgroundColor: tc.background, borderRadius: radius.md, padding: 12 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateDivider: { width: 1, backgroundColor: tc.border },
  dateLabel: { fontSize: 11, color: tc.textMuted, marginBottom: 4 },
  dateVal: { fontSize: 13, fontWeight: '600', color: tc.text },
  notes: { fontSize: 13, color: tc.textSecondary, marginTop: 10, fontStyle: 'italic' },
  sharedSection: { marginBottom: 18 },
  sharedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sharedTitle: { fontSize: 15, fontWeight: '700', color: tc.text },
  retryText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  sharedHint: { color: tc.textSecondary, fontSize: 12, lineHeight: 17, paddingVertical: 5 },
  sharedCard: { padding: 13, marginBottom: 9, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, backgroundColor: tc.surface },
  sharedCardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#E5F7F1' },
  verifiedBadgeText: { color: '#087f65', fontSize: 10, fontWeight: '700' },
  sharedBadgeText: { color: '#56758a' },
  sharedDetail: { marginTop: 8, color: tc.textSecondary, fontSize: 12, lineHeight: 17 },
  sharedDate: { marginTop: 5, color: tc.textMuted, fontSize: 11 },
  verifiedBy: { marginTop: 5, color: tc.textSecondary, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginVertical: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: tc.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: tc.text, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg, marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  outlineBtn: { flex: 1, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  outlineBtnText: { fontSize: 14, color: tc.text },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
