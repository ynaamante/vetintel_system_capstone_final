import AppHeader from '../components/AppHeader';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { ownerCareApi } from '../services/api';
import { dateLabel, statusLabel, upcomingAppointments } from '../utils/ownerCare';
export default function AppointmentsScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const { token } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const load = useCallback(async (active: () => boolean = () => true) => {
    if (!token) return;
    try { const data = await ownerCareApi.overview(token); if (active()) { setRows(data.appointments); setError(''); } }
    catch (failure: any) { if (active()) setError(failure.message || 'Unable to load appointments.'); }
    finally { if (active()) setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { let active = true; void load(() => active); const timer = setInterval(() => { void load(() => active); }, 30000); return () => { active = false; clearInterval(timer); }; }, [load]));
  const upcoming = upcomingAppointments(rows);
  const past = rows.filter(a => !upcoming.some(u => String(u.id) === String(a.id))).sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  const query = search.trim().toLowerCase();
  const visible = (tab === 'upcoming' ? upcoming : past).filter(item => !query || [item.pet, item.reason, item.clinic_name, item.practitioner, statusLabel(item.status), dateLabel(item.start_time)].some(value => String(value || '').toLowerCase().includes(query)));
  const s = styles(tc, isDark);
  const pending = (item: any) => ['pending', 'pending_confirmation'].includes(item.status);
  const badge = (item: any) => pending(item) ? 'Pending' : statusLabel(item.status);
  const statusColor = (item: any) => pending(item) ? '#B78000' : ['cancelled', 'canceled', 'no_show'].includes(item.status) ? colors.danger : '#087025';
  return <SafeAreaView style={s.safe} edges={['top','left','right']}>
    <AppHeader title="Appointments" subtitle="Manage your pet?s clinic visits." onBack={() => navigation.navigate('Home')} />
    <View style={s.panel}>
      <View style={s.controls}>
        <TouchableOpacity style={s.book} onPress={() => navigation.navigate('BookAppointment')}><Text style={s.bookText}>Book Appointment</Text></TouchableOpacity>
        <View style={s.tabs}>{['upcoming','past'].map(value => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} style={[s.tab, tab === value && s.activeTab]} onPress={() => setTab(value)}><Text style={[s.tabText, tab === value && s.activeTabText]}>{value === 'upcoming' ? `Upcoming (${upcoming.length})` : 'Past'}</Text></TouchableOpacity>)}</View>
        <View style={s.search}><Ionicons name="search-outline" size={23} color={tc.textMuted} /><TextInput accessibilityLabel="Search appointments" placeholder="Search appointments" placeholderTextColor={tc.textMuted} value={search} onChangeText={setSearch} style={s.searchInput} />{!!search && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setSearch('')}><Ionicons name="close-circle-outline" size={21} color={tc.textMuted} /></TouchableOpacity>}</View>
      </View>
      {!!error && <TouchableOpacity onPress={() => load()}><Text style={s.error}>{error} Tap to retry.</Text></TouchableOpacity>}
      <FlatList data={visible} keyExtractor={item => String(item.id)} contentContainerStyle={s.list} refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <TouchableOpacity accessibilityLabel={`View ${item.reason} appointment for ${item.pet}`} style={s.card} onPress={() => setSelected(item)}>
          <View style={s.cardTop}><Text style={s.date}>{dateLabel(item.start_time)} ? {new Date(item.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text><View style={[s.badge, { backgroundColor: pending(item) ? '#FFF8E4' : isDark ? tc.background : '#ECF8ED' }]}><View style={[s.dot, { backgroundColor: statusColor(item) }]} /><Text style={[s.badgeText, { color: statusColor(item) }]}>{badge(item)}</Text></View></View>
          <Text style={s.name}>{item.reason || 'Clinic appointment'}</Text>
          <Text style={s.text}>{item.pet} ? {item.practitioner || 'Veterinarian to be assigned'}</Text>
          <View style={s.clinicRow}><Text style={[s.text, { flex: 1, color: tc.text }]}>{item.clinic_name}</Text><Ionicons name="chevron-forward" size={22} color={tc.text} /></View>
        </TouchableOpacity>}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="calendar-outline" size={40} color={tc.textMuted} /><Text style={s.text}>{loading ? 'Loading appointments...' : error ? 'Appointments could not be loaded.' : query ? 'No matching appointments.' : tab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'}</Text></View>} />
    </View>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={s.backdrop}><View style={s.sheet}><View style={s.cardTop}><Text style={[s.name, { flex: 1 }]}>Appointment details</Text><TouchableOpacity accessibilityLabel="Close appointment details" onPress={() => setSelected(null)} style={{ padding: 8 }}><Ionicons name="close" size={24} color={tc.text} /></TouchableOpacity></View><ScrollView><Text style={s.name}>{selected?.reason}</Text><Text style={s.text}>{selected?.pet} ? {selected?.practitioner || 'Veterinarian to be assigned'}</Text><Text style={s.date}>{selected ? dateLabel(selected.start_time) + ' ? ' + new Date(selected.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</Text><Text style={s.text}>{selected?.clinic_name}</Text><Text style={s.text}>{selected ? statusLabel(selected.status) : ''}</Text>{!!selected?.notes && <Text style={s.text}>{selected.notes}</Text>}{selected && pending(selected) && <Text style={s.text}>Your clinic will confirm the requested time.</Text>}<Text style={[s.text, { marginTop: 14 }]}>For changes or cancellations, contact your clinic.</Text></ScrollView><TouchableOpacity style={[s.book, { marginTop: 18 }]} onPress={() => setSelected(null)}><Text style={s.bookText}>Done</Text></TouchableOpacity></View></View></Modal>
  </SafeAreaView>;
}
const styles = (tc: any, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#005638' }, panel: { flex: 1, backgroundColor: dark ? tc.background : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, controls: { paddingHorizontal: 16, paddingTop: 22 },
  book: { minHeight: 46, backgroundColor: '#005638', borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 10 }, bookText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' }, tabs: { flexDirection: 'row', backgroundColor: dark ? tc.surface : '#F7F8F7', borderWidth: 1, borderColor: dark ? tc.border : '#E0E2E1', borderRadius: 13, padding: 2, marginTop: 16 }, tab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, activeTab: { backgroundColor: '#005638' }, tabText: { color: tc.text, fontWeight: '700', fontSize: 15 }, activeTabText: { color: '#FFFFFF' },
  search: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: dark ? tc.border : '#E0E2E1', borderRadius: 13, paddingHorizontal: 12, marginTop: 15, marginBottom: 16 }, searchInput: { flex: 1, color: tc.text, fontSize: 15, paddingVertical: 9 }, list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { padding: 14, backgroundColor: tc.surface, borderWidth: 1, borderColor: dark ? tc.border : '#E5E7E5', borderRadius: 13, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.09, shadowOffset: { width: 0, height: 2 }, shadowRadius: 2, elevation: 2 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }, date: { flexShrink: 1, color: dark ? tc.text : '#087025', fontSize: 13, lineHeight: 19, fontWeight: '700' }, name: { color: tc.text, fontSize: 18, lineHeight: 24, fontWeight: '700' }, text: { color: tc.textSecondary, fontSize: 14, lineHeight: 21 }, badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }, dot: { width: 8, height: 8, borderRadius: 4 }, badgeText: { fontSize: 12, fontWeight: '600' }, clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: dark ? tc.border : '#E0E7E2', paddingTop: 10, marginTop: 9 }, empty: { padding: 30, alignItems: 'center', gap: 12 }, error: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 12 }, backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { maxHeight: '80%', backgroundColor: tc.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
});
