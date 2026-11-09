import { useOwnerNotifications } from '../context/OwnerNotificationsContext';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, parseISO } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme/colors';
import { petsApi, appointmentsApi, alertsApi, ownerSharedRecordsApi } from '../services/api';

type SharedRecordBundle = {
  id: string;
  petName: string;
  clinicName: string;
  createdAt: string;
  message?: string;
  records: { id: string; category: string; title: string; detail: string; date?: string }[];
};

const DOG_IMG = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&q=80';
const CAT_IMG = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&q=80';

export default function HomeScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const { token } = useAuth();
  const s = styles(tc, isDark);
  
  const [pets, setPets] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [sharedRecordBundles, setSharedRecordBundles] = useState<SharedRecordBundle[]>([]);
  const [sharedRecordsError, setSharedRecordsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [petsData, alertsData, appointmentsData, sharedRecordsData] = await Promise.all([
        petsApi.list(token!).catch(err => {
          console.error('Error fetching pets:', err);
          return [];
        }),
        alertsApi.list(token!).catch(err => {
          console.error('Error fetching alerts:', err);
          return [];
        }),
        appointmentsApi.list(token!).catch(err => {
          console.error('Error fetching appointments:', err);
          return [];
        }),
        ownerSharedRecordsApi.list(token!).then((data: SharedRecordBundle[]) => {
          if (!Array.isArray(data)) throw new Error('The shared records response was not valid.');
          setSharedRecordsError('');
          return data;
        }).catch(err => {
          console.error('Error fetching owner-shared records:', err);
          setSharedRecordsError(err.message || 'Unable to load records shared by your clinic.');
          return [];
        }),
      ]);

      setPets(Array.isArray(petsData) ? petsData : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
      setSharedRecordBundles(sharedRecordsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Error loading home data:', err);
    } finally {
      setLoading(false);
    }
  };

  const { notifications, unreadCount: unread } = useOwnerNotifications();
  const highAlerts = [...notifications, ...alerts].filter(a => a.severity === 'high' && !a.read);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.header}>
          <View><Text style={s.title}>My Pets</Text><Text style={s.subtitle}>Manage your pets' health and wellness</Text></View>
          <TouchableOpacity style={s.notifBtn} onPress={() => navigation.navigate('Alerts')}>
            <Ionicons name="notifications-outline" size={22} color={tc.text} />
            {unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{unread}</Text></View>}
          </TouchableOpacity>
        </View>

        {highAlerts.length > 0 && (
          <TouchableOpacity style={s.alertBanner} onPress={() => navigation.navigate('Alerts')}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.alertTitle}>{highAlerts[0].title}</Text>
              <Text style={s.alertMsg} numberOfLines={2}>{highAlerts[0].message}</Text>
            </View>
          </TouchableOpacity>
        )}

        {appointments.length > 0 && (
          <View style={s.reminderCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="calendar" size={18} color="#C2410C" />
              <Text style={s.reminderTitle}>Upcoming Appointments</Text>
            </View>
            {appointments.slice(0, 2).map((apt: any) => (
              <Text key={apt.id} style={s.reminderItem}>
                • {apt.date ? new Date(apt.date).toLocaleDateString() : 'Scheduled'} with {apt.clinicName || 'Clinic'}
              </Text>
            ))}
          </View>
        )}

        <View style={s.quickGrid}>
          {[{ icon: 'add-circle-outline', label: 'Add Pet', color: colors.primary, route: 'AddPet' },
            { icon: 'alert-circle-outline', label: 'Alerts', color: colors.warning, route: 'Alerts', badge: unread },
            { icon: 'calendar-outline', label: 'Appointments', color: colors.success, route: 'Appointments' }].map(item => (
            <TouchableOpacity key={item.label} style={s.quickCard} onPress={() => navigation.navigate(item.route)} activeOpacity={0.7}>
              {item.badge ? <View style={s.qBadge}><Text style={s.qBadgeText}>{item.badge}</Text></View> : null}
              <Ionicons name={item.icon as any} size={30} color={item.color} />
              <Text style={s.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.linkGrid}>
          {[{ icon: 'bulb-outline', label: 'Health Tips', sub: 'Expert advice', color: colors.secondary, bg: '#F3E8FF', route: 'HealthTips' },
            { icon: 'location-outline', label: 'Find Clinics', sub: 'Nearby vets', color: colors.primary, bg: '#EFF6FF', route: 'NearbyClinics' }].map(item => (
            <TouchableOpacity key={item.label} style={s.linkCard} onPress={() => navigation.navigate(item.route)} activeOpacity={0.7}>
              <View style={[s.linkIcon, { backgroundColor: item.bg }]}><Ionicons name={item.icon as any} size={20} color={item.color} /></View>
              <View style={{ flex: 1 }}><Text style={s.linkTitle}>{item.label}</Text><Text style={s.linkSub}>{item.sub}</Text></View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Shared by your clinic</Text>
          {sharedRecordsError ? <TouchableOpacity onPress={loadData}><Text style={s.sharedRetry}>Retry</Text></TouchableOpacity> : null}
        </View>
        {sharedRecordsError ? (
          <View style={s.sharedEmpty}><Text style={s.sharedHint}>{sharedRecordsError}</Text></View>
        ) : sharedRecordBundles.length ? (
          sharedRecordBundles.map(bundle => (
            <View key={bundle.id} style={s.sharedBundle}>
              <Text style={s.sharedClinic}>{bundle.petName} · {bundle.clinicName}</Text>
              <Text style={s.sharedDate}>{new Date(bundle.createdAt).toLocaleDateString()}</Text>
              {bundle.message ? <Text style={s.sharedMessage}>{bundle.message}</Text> : null}
              {bundle.records.map(item => (
                <View key={item.id} style={s.sharedRecord}>
                  <Text style={s.sharedCategory}>{item.category}</Text>
                  <Text style={s.sharedRecordTitle}>{item.title}</Text>
                  {item.detail ? <Text style={s.sharedHint}>{item.detail}</Text> : null}
                  {item.date ? <Text style={s.sharedDate}>{new Date(item.date).toLocaleDateString()}</Text> : null}
                </View>
              ))}
            </View>
          ))
        ) : (
          <View style={s.sharedEmpty}>
            <Text style={s.sharedHint}>Records your clinic chooses to share will appear here.</Text>
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Your Pets</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('AddPet')}>
            <Ionicons name="add" size={16} color={colors.primary} /><Text style={s.addBtnText}>Add Pet</Text>
          </TouchableOpacity>
        </View>

        {pets.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="paw" size={48} color={tc.textMuted} />
            <Text style={s.emptyText}>No pets yet</Text>
            <Text style={s.emptySubtext}>Add your first pet to get started</Text>
            <TouchableOpacity style={s.emptyButton} onPress={() => navigation.navigate('AddPet')}>
              <Text style={s.emptyButtonText}>Add Pet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          pets.map((pet: any) => (
            <TouchableOpacity key={pet.id} style={s.petCard} onPress={() => navigation.navigate('PetDetails', { petId: pet.id })} activeOpacity={0.8}>
              <Image source={{ uri: pet.species === 'dog' ? DOG_IMG : CAT_IMG }} style={s.petImg} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.petName}>{pet.name}</Text>
                <Text style={s.petInfo}>{pet.breed || 'Mixed'} • {pet.age || '0'} yrs</Text>
                <View style={s.speciesBadge}><Text style={s.speciesText}>{pet.species || 'Pet'}</Text></View>
              </View>
              <View style={s.petActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('ReportSymptoms', { petId: pet.id })}>
                  <Ionicons name="alert-circle-outline" size={14} color={tc.textSecondary} /><Text style={s.actionBtnText}>Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('HealthReport', { petId: pet.id })}>
                  <Ionicons name="document-text-outline" size={14} color={tc.textSecondary} /><Text style={s.actionBtnText}>Health</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  container: { padding: spacing.md, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: tc.text },
  subtitle: { fontSize: 14, color: tc.textSecondary, marginTop: 2 },
  notifBtn: { padding: 4, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: colors.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: radius.md, padding: 14, marginBottom: 12 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#991B1B', marginBottom: 2 },
  alertMsg: { fontSize: 13, color: '#B91C1C' },
  reminderCard: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: radius.md, padding: 14, marginBottom: 12 },
  reminderTitle: { fontSize: 15, fontWeight: '600', color: '#9A3412' },
  reminderItem: { fontSize: 13, color: '#C2410C', marginBottom: 2 },
  quickGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickCard: { flex: 1, backgroundColor: tc.surface, borderRadius: radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: tc.border, position: 'relative' },
  qBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  qBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  quickLabel: { fontSize: 12, color: tc.text, marginTop: 6, textAlign: 'center' },
  linkGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  linkCard: { flex: 1, backgroundColor: tc.surface, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: tc.border },
  linkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 14, fontWeight: '600', color: tc.text },
  linkSub: { fontSize: 12, color: tc.textSecondary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: tc.text },
  sharedRetry: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  sharedBundle: { padding: 14, marginBottom: 10, borderWidth: 1, borderColor: tc.border, borderRadius: radius.lg, backgroundColor: tc.surface },
  sharedClinic: { color: tc.text, fontSize: 14, fontWeight: '700' },
  sharedDate: { marginTop: 3, color: tc.textMuted, fontSize: 11 },
  sharedMessage: { marginTop: 8, color: tc.textSecondary, fontSize: 13, lineHeight: 18 },
  sharedRecord: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: tc.border, marginTop: 7 },
  sharedCategory: { marginBottom: 2, color: colors.primary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  sharedRecordTitle: { color: tc.text, fontSize: 14, fontWeight: '600' },
  sharedHint: { marginTop: 3, color: tc.textSecondary, fontSize: 12, lineHeight: 17 },
  sharedEmpty: { padding: 14, marginBottom: 16, borderWidth: 1, borderColor: tc.border, borderRadius: radius.lg, backgroundColor: tc.surface },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  petCard: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: tc.border },
  petImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: tc.border },
  petName: { fontSize: 16, fontWeight: '700', color: tc.text, marginBottom: 2 },
  petInfo: { fontSize: 13, color: tc.textSecondary, marginBottom: 6 },
  speciesBadge: { backgroundColor: tc.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  speciesText: { fontSize: 11, color: tc.textSecondary, textTransform: 'capitalize' },
  petActions: { gap: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: tc.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  actionBtnText: { fontSize: 12, color: tc.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: tc.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: tc.border, paddingHorizontal: 20 },
  emptyText: { fontSize: 18, fontWeight: '600', color: tc.text, marginTop: 12 },
  emptySubtext: { fontSize: 14, color: tc.textSecondary, marginTop: 4, textAlign: 'center' },
  emptyButton: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.md },
  emptyButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
