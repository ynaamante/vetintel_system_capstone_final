import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { mockAppointments, Appointment } from '../data/mockData';

type Tab = 'upcoming' | 'past';
const statusC: Record<string, any> = { upcoming: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' }, completed: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' }, cancelled: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' } };

export default function AppointmentsScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const s = styles(tc, isDark);
  const upcoming = mockAppointments.filter(a => a.status === 'upcoming');
  const past = mockAppointments.filter(a => a.status === 'completed');
  const shown = tab === 'upcoming' ? upcoming : past;

  const openReschedule = (a: Appointment) => { setSel(a); setNewDate(a.date); setNewTime(a.time); setModal(true); };
  const confirm = () => { if (!newDate || !newTime) { Toast.show({ type: 'error', text1: 'Enter date and time' }); return; } Toast.show({ type: 'success', text1: 'Appointment rescheduled!' }); setModal(false); };
  const cancel = (a: Appointment) => Alert.alert('Cancel', `Cancel ${a.petName}'s appointment?`, [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: () => Toast.show({ type: 'success', text1: 'Cancelled' }) }]);

  const AppCard = ({ item }: { item: Appointment }) => {
    const sc = statusC[item.status] || statusC.upcoming;
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}><Text style={s.petName}>{item.petName}</Text><View style={s.typeBadge}><Text style={s.typeText}>{item.type}</Text></View></View>
          <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}><Text style={[s.statusText, { color: sc.text }]}>{item.status}</Text></View>
        </View>
        <View style={s.infoRow}><Ionicons name="calendar-outline" size={15} color={tc.textSecondary} /><Text style={s.infoText}>{format(parseISO(item.date), 'EEEE, MMMM dd, yyyy')}</Text></View>
        <View style={s.infoRow}><Ionicons name="time-outline" size={15} color={tc.textSecondary} /><Text style={s.infoText}>{item.time}</Text></View>
        <View style={s.infoRow}><Ionicons name="person-outline" size={15} color={tc.textSecondary} /><Text style={s.infoText}>{item.vetName}</Text></View>
        {item.clinicName && <View style={s.infoRow}><Ionicons name="location-outline" size={15} color={tc.textSecondary} /><Text style={s.infoText}>{item.clinicName}</Text></View>}
        {item.status === 'upcoming' && (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.outlineBtn} onPress={() => openReschedule(item)}><Text style={s.outlineBtnText}>Reschedule</Text></TouchableOpacity>
            <TouchableOpacity style={[s.outlineBtn, { borderColor: '#FECACA' }]} onPress={() => cancel(item)}><Text style={[s.outlineBtnText, { color: colors.danger }]}>Cancel</Text></TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.pageHeader}>
        <View><Text style={s.pageTitle}>Appointments</Text><Text style={s.pageSub}>Manage your pet's vet appointments</Text></View>
        <TouchableOpacity style={s.bookBtn} onPress={() => navigation.navigate('BookAppointment')}><Ionicons name="add" size={16} color="#fff" /><Text style={s.bookBtnText}>Book</Text></TouchableOpacity>
      </View>
      <View style={s.statsRow}>
        <View style={s.statCard}><Text style={[s.statVal, { color: colors.primary }]}>{upcoming.length}</Text><Text style={s.statLabel}>Upcoming</Text></View>
        <View style={s.statCard}><Text style={[s.statVal, { color: colors.success }]}>{past.length}</Text><Text style={s.statLabel}>Completed</Text></View>
      </View>
      <View style={s.tabRow}>
        {(['upcoming', 'past'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={shown} keyExtractor={i => i.id} renderItem={({ item }) => <AppCard item={item} />} contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="calendar-outline" size={48} color={tc.textMuted} /><Text style={s.emptyText}>No {tab} appointments</Text>{tab === 'upcoming' && <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('BookAppointment')}><Text style={s.primaryBtnText}>Book Appointment</Text></TouchableOpacity>}</View>}
        ListFooterComponent={<TouchableOpacity style={s.ctaBanner} onPress={() => navigation.navigate('BookAppointment')}><Ionicons name="calendar" size={28} color={colors.primary} /><View style={{ flex: 1, marginLeft: 12 }}><Text style={s.ctaTitle}>Need to see a vet?</Text><Text style={s.ctaSub}>Book an appointment for your pet</Text></View></TouchableOpacity>}
      />
      <Modal visible={modal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Reschedule Appointment</Text>
            <Text style={s.modalSub}>Choose new date and time for {sel?.petName}</Text>
            <Text style={s.label}>New Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={newDate} onChangeText={setNewDate} placeholder="2026-07-25" placeholderTextColor={tc.textMuted} />
            <Text style={s.label}>New Time</Text>
            <TextInput style={s.input} value={newTime} onChangeText={setNewTime} placeholder="10:00 AM" placeholderTextColor={tc.textMuted} />
            {sel && <View style={s.currentInfo}><Text style={s.currentInfoText}>Current: {format(parseISO(sel.date), 'MMM dd, yyyy')} at {sel.time}</Text></View>}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.outlineBtn} onPress={() => setModal(false)}><Text style={s.outlineBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={confirm}><Text style={s.primaryBtnText}>Confirm</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, paddingBottom: 0 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: tc.text },
  pageSub: { fontSize: 14, color: tc.textSecondary },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  bookBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, padding: spacing.md, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: tc.surface, borderRadius: radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: tc.border },
  statVal: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, color: tc.textSecondary, marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: 14, backgroundColor: tc.border, borderRadius: radius.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: tc.surface },
  tabText: { fontSize: 14, color: tc.textSecondary },
  tabTextActive: { color: tc.text, fontWeight: '600' },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: tc.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  petName: { fontSize: 16, fontWeight: '700', color: tc.text, marginBottom: 4 },
  typeBadge: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  typeText: { fontSize: 12, color: tc.textSecondary },
  statusBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoText: { fontSize: 14, color: tc.textSecondary },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  outlineBtn: { flex: 1, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  outlineBtnText: { fontSize: 14, color: tc.text },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginVertical: 12 },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  ctaBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF', borderWidth: 1, borderColor: isDark ? '#2563EB' : '#BFDBFE', borderRadius: radius.lg, padding: 16, marginTop: 4 },
  ctaTitle: { fontSize: 15, fontWeight: '600', color: isDark ? '#BFDBFE' : '#1E40AF' },
  ctaSub: { fontSize: 13, color: isDark ? '#D2E5DC' : '#087A70' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: tc.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: tc.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: tc.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg, marginBottom: 16 },
  currentInfo: { backgroundColor: tc.border, borderRadius: radius.md, padding: 12, marginBottom: 16 },
  currentInfoText: { fontSize: 13, color: tc.textSecondary },
  modalBtns: { flexDirection: 'row', gap: 10 },
});
