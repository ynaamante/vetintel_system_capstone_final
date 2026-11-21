import AppHeader from '../components/AppHeader';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Image, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { isDiseaseAlert } from './AlertsScreen';
import { useOwnerNotifications } from '../context/OwnerNotificationsContext';
import { petsApi, ownerCareApi, ownerSharedRecordsApi } from '../services/api';
import { upcomingAppointments, dateLabel, statusLabel } from '../utils/ownerCare';
const GREEN = '#005638';
const HOME_BOLD = { fontWeight: '700' as const };
export default function HomeScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const { token, userName } = useAuth();
  const { notifications, unreadCount, refresh: refreshNotifications, error: notificationError } = useOwnerNotifications();
  const [pets, setPets] = useState<any[]>([]);
  const [care, setCare] = useState<any>({ clinicPets: [], appointments: [] });
  const [shares, setShares] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [archiving, setArchiving] = useState(false);
  const dataRevision = useRef(0);

  const s = styles(tc, isDark);
  useFocusEffect(useCallback(() => {
    StatusBar.setBarStyle('light-content');
    return () => StatusBar.setBarStyle('default');
  }, []));
  const load = useCallback(async (active: () => boolean = () => true) => {
    if (!token) return;
    const revision = ++dataRevision.current;
    const results = await Promise.allSettled([petsApi.list(token), ownerCareApi.overview(token), ownerSharedRecordsApi.list(token)]);
    if (!active() || dataRevision.current !== revision) return;
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') failures.push(['Pets', 'Clinic appointments', 'Shared records'][index] + ': ' + (result.reason?.message || 'Unable to load.'));
      else if (index === 0) setPets(result.value);
      else if (index === 1) setCare(result.value);
      else setShares(result.value);
    });
    setErrors(failures); setLoading(false);
  }, [token]);
  useFocusEffect(useCallback(() => {
    let active = true; void load(() => active);
    const timer = setInterval(() => { void load(() => active); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [load]));
  const refresh = async () => { setRefreshing(true); try { await Promise.all([load(), refreshNotifications()]); } finally { setRefreshing(false); } };
  const upcoming = upcomingAppointments(care.appointments);
  const next = upcoming.find(a => !['pending', 'pending_confirmation'].includes(a.status));
  const pending = upcoming.filter(a => ['pending', 'pending_confirmation'].includes(a.status));
  const reminders = notifications.filter(n => !n.read).slice(0, 2);
  const allPets = [...pets.map(p => ({ ...p, source: 'account' })), ...care.clinicPets.map((p: any) => ({ ...p, source: 'clinic' }))];
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const confirmArchive = async () => {
    if (!token || !archiveTarget || archiving) return;
    const target = archiveTarget;
    setArchiving(true); dataRevision.current++;
    try {
      await ownerCareApi.archivePet(String(target.id), target.source, true, token);
      dataRevision.current++;
      if (target.source === 'clinic') setCare((current: any) => ({ ...current, clinicPets: current.clinicPets.filter((p: any) => String(p.id) !== String(target.id)) }));
      else setPets(current => current.filter(p => String(p.id) !== String(target.id)));
      setArchiveTarget(null);
      Toast.show({ type: 'success', text1: `${target.name} archived`, text2: 'Restore this pet from Archived pets.' });
      await load();
    } catch (failure: any) { Toast.show({ type: 'error', text1: failure.message || 'Unable to archive this pet.' }); }
    finally { setArchiving(false); }
  };
  const openPet = (pet: any) => navigation.navigate('PetProfile', { petId: pet.id, pet });
  const icon = (name: any, size = 26, color = GREEN) => <Ionicons name={name} size={size} color={color} />;
  const section = (title: string, trailing?: React.ReactNode) => <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{trailing}</View>;
  const records = (bundles: any[]) => bundles.map(bundle => <View key={bundle.id} style={s.record}>
    <Text style={s.name}>{bundle.petName} · {bundle.clinicName}</Text><Text style={s.small}>{dateLabel(bundle.createdAt)}</Text>
    {!!bundle.message && <Text style={s.body}>{bundle.message}</Text>}
    {bundle.records.map((r: any) => <View key={r.id} style={s.recordLine}><Text style={s.kicker}>{r.category}</Text><Text style={s.name}>{r.title}</Text><Text style={s.body}>{r.detail}</Text>{!!r.date && <Text style={s.small}>{dateLabel(r.date)}</Text>}</View>)}
  </View>);
  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ flex: 1 }} color={GREEN} /></SafeAreaView>;
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <AppHeader home title={greeting + (userName ? `, ${userName.split(' ')[0]}` : '') + '.'} subtitle="A little care. A healthier, happier pet." />
    <View style={s.contentPanel}>
    <ScrollView style={s.scroll} contentContainerStyle={s.container} contentInsetAdjustmentBehavior="never" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={GREEN} />}>

      {[...errors, ...(notificationError ? [notificationError] : [])].map(e => <TouchableOpacity key={e} onPress={refresh} style={s.error}><Text style={s.body}>{e} Tap to retry.</Text></TouchableOpacity>)}
      {section('Care overview', <Text style={s.small}><Text style={{ color: GREEN }}>●</Text> For your pets</Text>)}
      <View style={s.overview}>
        <TouchableOpacity style={s.appointment} onPress={() => navigation.navigate('Appointments')}>
          <View style={s.calendar}><Text style={s.month}>{next ? new Date(next.start_time).toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : 'NEXT'}</Text><Text style={s.day}>{next ? new Date(next.start_time).getDate() : '—'}</Text></View>
          <View style={s.appointmentDetail}><Text style={s.kicker}>NEXT APPOINTMENT</Text><Text style={s.name}>{next ? `${next.pet} · ${next.reason}` : 'No confirmed visits yet'}</Text><Text style={s.small}>{next ? `${new Date(next.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${next.clinic_name || next.practitioner}` : 'Book a visit or view your requests'}</Text></View>{icon('chevron-forward', 18, tc.textMuted)}
        </TouchableOpacity>
        {pending.length > 0 && <TouchableOpacity style={s.careRow} onPress={() => navigation.navigate('Appointments')}>{icon('time-outline', 17, '#B7791F')}<Text style={[s.body, { flex: 1 }]}>{pending.length} request{pending.length === 1 ? '' : 's'} · Awaiting clinic confirmation</Text>{icon('chevron-forward', 16, tc.textMuted)}</TouchableOpacity>}
        {reminders.map(n => <TouchableOpacity key={n.id} style={s.careRow} onPress={() => navigation.navigate(isDiseaseAlert(n) ? 'Alerts' : 'Notifications')}><View style={[s.dotInline, { backgroundColor: n.severity === 'high' ? '#D67621' : GREEN }]} /><Text numberOfLines={2} style={[s.body, { flex: 1 }]}>{n.title} · {n.message}</Text>{icon('chevron-forward', 16, tc.textMuted)}</TouchableOpacity>)}
        {!reminders.length && <Text style={[s.small, s.emptyReminders]}>No unread clinic reminders.</Text>}
      </View>
      <TouchableOpacity style={s.book} onPress={() => navigation.navigate('BookAppointment')}>{icon('calendar-outline', 24, '#fff')}<Text style={s.bookText}>Book appointment</Text></TouchableOpacity>
      {section(`My pets (${allPets.length})`, <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><TouchableOpacity accessibilityLabel="View archived pets" onPress={() => navigation.navigate('ArchivedPets')}><Text style={s.link}>Archived pets</Text></TouchableOpacity><View style={s.actionDivider} /><TouchableOpacity style={s.add} onPress={() => navigation.navigate('AddPet')}><Text style={s.link}>Add pet</Text></TouchableOpacity></View>)}
      {!allPets.length && <TouchableOpacity style={s.record} onPress={() => navigation.navigate('AddPet')}><Text style={s.name}>Welcome! Add your first pet</Text><Text style={s.body}>Clinic records appear when your clinic registers your account email.</Text></TouchableOpacity>}
      {allPets.map(pet => {
        const visit = pet.source === 'clinic' ? upcoming.find(a => String(a.pet_id) === String(pet.id) && String(a.clinic_id) === String(pet.clinic_id)) : null;
        return <TouchableOpacity key={`${pet.source}-${pet.id}`} style={s.petCard} onPress={() => openPet(pet)} onLongPress={() => setArchiveTarget(pet)} delayLongPress={250} accessibilityHint="Tap to open profile. Long press to archive this pet.">
          {pet.photo_url ? <Image source={{ uri: pet.photo_url }} style={s.avatar} /> : <View style={s.avatar}>{icon('paw-outline', 30)}</View>}<View style={{ flex: 1 }}><Text style={s.petName}>{pet.name}</Text><Text style={s.small}>{pet.species} · {pet.breed || 'Breed not recorded'}</Text><Text style={s.small}>{pet.source === 'clinic' ? pet.clinic_name : pet.age ? `${pet.age} years old · My pet` : 'My pet'}</Text>{visit && <View style={s.pill}><View style={s.statusDot} /><Text style={s.pillText}>{statusLabel(visit.status)} · {dateLabel(visit.start_time)}</Text></View>}</View>{icon('chevron-forward', 19, tc.text)}
        </TouchableOpacity>;
      })}
      {section('Explore care')}
      <View style={s.explore}>
        {[{ name: 'Nearby clinics', sub: 'Find the right care', icon: 'location-outline', route: 'NearbyClinics' }, { name: 'Health tips', sub: 'Everyday pet care', icon: 'book-outline', route: 'HealthTips' }].map(item => <TouchableOpacity key={item.route} style={s.exploreCard} onPress={() => navigation.navigate(item.route)}>{icon(item.icon)}<View style={{ flex: 1 }}><Text style={s.name}>{item.name}</Text><Text style={s.small}>{item.sub}</Text></View>{icon('chevron-forward', 14, tc.textMuted)}</TouchableOpacity>)}
      </View>
      <TouchableOpacity style={s.advisory} onPress={() => navigation.navigate('Notifications')}>{icon('shield-checkmark-outline')}<Text style={[s.body, { flex: 1, color: tc.text }]}>Clinic alerts & reminders</Text>{icon('chevron-forward', 17, tc.textMuted)}</TouchableOpacity>
      {shares.length > 0 && <>{section('Shared by your clinic')}{records(shares)}</>}
    </ScrollView>
    </View>
    <Modal visible={!!archiveTarget} transparent animationType="none" onRequestClose={() => { if (!archiving) setArchiveTarget(null); }}><View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 }}><View style={{ backgroundColor: tc.surface, borderRadius: 18, padding: 22 }}><Text style={[s.sectionTitle, { fontSize: 20, marginBottom: 12 }]}>Archive {archiveTarget?.name}?</Text><Text style={[s.body, { fontSize: 15, lineHeight: 22 }]}>Do you want to archive {archiveTarget?.name}? You can restore this pet anytime from Archived pets.</Text><TouchableOpacity disabled={archiving} onPress={confirmArchive} style={[s.book, { marginTop: 20, marginBottom: 8, minHeight: 48, opacity: archiving ? 0.6 : 1 }]}><Text style={s.bookText}>{archiving ? 'Archiving...' : 'Archive'}</Text></TouchableOpacity><TouchableOpacity disabled={archiving} onPress={() => setArchiveTarget(null)} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={[s.name, { fontSize: 15 }]}>Cancel</Text></TouchableOpacity></View></View></Modal>
  </SafeAreaView>;
}
const styles = (tc: any, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN }, contentPanel: { flex: 1, backgroundColor: dark ? tc.background : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, scroll: { flex: 1 }, container: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  appointmentDetail: { flex: 1, borderLeftWidth: 1, borderColor: '#CADDD1', paddingLeft: 12 }, emptyReminders: { borderTopWidth: 1, borderColor: '#CADDD1', paddingVertical: 8, paddingHorizontal: 7 }, header: { position: 'relative', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, marginBottom: 0 }, bell: { padding: 8 }, dot: { position: 'absolute', right: 8, top: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D61B' },
  messageDot: { position: 'absolute', right: 4, top: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN, borderWidth: 1, borderColor: tc.background },
  greeting: { ...HOME_BOLD, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: '#FFFFFF', marginTop: 0 }, subtitle: { color: '#E7F4EC', fontSize: 13, marginTop: 2, marginBottom: 0 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 }, sectionTitle: { ...HOME_BOLD, fontSize: 20, lineHeight: 25, letterSpacing: -0.35, color: dark ? tc.text : GREEN },
  small: { fontSize: 12, lineHeight: 15, color: tc.textSecondary }, body: { fontSize: 13, lineHeight: 19, color: tc.textSecondary }, name: { ...HOME_BOLD, fontSize: 14, lineHeight: 18, color: dark ? tc.text : '#111111' },
  overview: { borderRadius: 14, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', backgroundColor: dark ? tc.surface : colors.paleSage, paddingHorizontal: 12 },
  appointment: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14 }, calendar: { width: 52, height: 50, justifyContent: 'center', borderRadius: 9, padding: 4, backgroundColor: tc.surface, alignItems: 'center' }, month: { ...HOME_BOLD, color: GREEN, fontSize: 12, lineHeight: 14 }, day: { ...HOME_BOLD, color: GREEN, fontSize: 27, lineHeight: 29 }, kicker: { fontSize: 10, color: tc.textSecondary, marginBottom: 1, textTransform: 'uppercase' },
  careRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', paddingVertical: 10 }, dotInline: { width: 7, height: 7, borderRadius: 4 },
  book: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 11, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 16 }, bookText: { ...HOME_BOLD, color: '#fff', fontSize: 16, lineHeight: 21 }, actionDivider: { width: 1, height: 15, backgroundColor: tc.border }, add: { flexDirection: 'row', alignItems: 'center', gap: 3 }, link: { ...HOME_BOLD, fontSize: 12, color: dark ? tc.text : GREEN },
  petCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 7, backgroundColor: tc.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2 }, avatar: { width: 76, height: 74, borderRadius: 12, backgroundColor: dark ? tc.background : colors.paleSage, alignItems: 'center', justifyContent: 'center' }, petName: { ...HOME_BOLD, fontSize: 15, lineHeight: 19, color: dark ? tc.text : '#111111' }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00CC20' }, pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: dark ? tc.background : colors.paleSage, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, marginTop: 4 }, pillText: { fontSize: 11, color: dark ? tc.text : GREEN },
  explore: { flexDirection: 'row', gap: 12 }, exploreCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 13, paddingVertical: 13, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', borderRadius: 13, backgroundColor: tc.surface }, advisory: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', borderRadius: 12, minHeight: 56, padding: 15, marginTop: 9, marginBottom: 16, backgroundColor: tc.surface },
  record: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', backgroundColor: tc.surface, marginBottom: 10 }, recordLine: { paddingTop: 10, borderTopWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', marginTop: 10 }, error: { padding: 12, borderRadius: 10, backgroundColor: dark ? tc.surface : '#FFF4D6', marginBottom: 8 },
});
