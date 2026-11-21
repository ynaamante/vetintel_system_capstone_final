import AppHeader from '../components/AppHeader';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Linking, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NavigationIcon from '../components/NavigationIcon';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Toast from 'react-native-toast-message';
import { savePetPhoto } from '../services/petPhoto';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useOwnerNotifications } from '../context/OwnerNotificationsContext';
import { ownerSharedRecordsApi, petsApi, ownerCareApi, petSharingApi } from '../services/api';
import { colors } from '../theme/colors';
import { dateLabel } from '../utils/ownerCare';

const GREEN = '#005638';
const BOLD = { fontWeight: '700' as const };
export default function PetProfileScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [pet, setPet] = useState<any>(route.params?.pet);
  const clinicPet = pet?.source === 'clinic';
  const { token } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const { notifications, unreadCount } = useOwnerNotifications();
  const [tab, setTab] = useState('overview');
  const [qr, setQr] = useState<{ value: string; expiresAt: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!qr) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [qr]);
  const showQR = async () => {
    if (!token || qrLoading) return;
    if (!clinicPet) { setSheet({ title: 'Pet medical-history QR', body: 'Register this pet at your clinic using your account email to link its medical history. Open the clinic-linked pet profile to show its QR.' }); return; }
    setQrLoading(true);
    try { const result = await petSharingApi.issue(String(pet.id), token); setNow(Date.now()); setQr(result); }
    catch (failure: any) { setSheet({ title: 'Pet QR', body: failure.message || 'Unable to create your QR. Please try again.' }); }
    finally { setQrLoading(false); }
  };
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInProgress = useRef(false);
  const profileRevision = useRef(0);
  const uploadPhoto = async () => {
    if (!token || uploadInProgress.current) return;
    uploadInProgress.current = true;
    profileRevision.current++;
    setUploading(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Photo access needed', 'Allow photo access to choose a pet picture. You can enable it in your phone settings.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings(); } }]);
          return;
        }
      }
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 1 });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const resize = Math.max(asset.width,asset.height) > 800 ? [{ resize: asset.width >= asset.height ? { width: 800 } : { height: 800 } }] : [];
      const image = await ImageManipulator.manipulateAsync(asset.uri, resize, { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!image.base64) throw new Error('Unable to read this photo. Please choose another image.');
      const saved = await savePetPhoto(String(pet.id), clinicPet, `data:image/jpeg;base64,${image.base64}`, token);
      profileRevision.current++;
      setPet((current: any) => ({ ...current, ...saved }));
      navigation.setParams({ pet: { ...pet, ...saved } });
      Toast.show({ type: 'success', text1: 'Photo uploaded', text2: 'Your pet picture has been saved.', visibilityTime: 5000 });
    } catch (failure: any) { setSheet({ title: 'Photo upload', body: failure.message || 'Unable to upload your pet photo. Please try again.' }); }
    finally { uploadInProgress.current = false; setUploading(false); }
  };
  const [editError, setEditError] = useState('');
  const [draft, setDraft] = useState({ name: '', breed: '', color: '', weight: '', birth_date: '', sex: 'unknown' });
  const openEdit = () => {
    setDraft({ name: pet.name || '', breed: pet.breed || '', color: pet.color || '', weight: String(pet.weight ?? ''), birth_date: pet.birth_date ? new Date(pet.birth_date).toISOString().slice(0,10) : '', sex: pet.sex || 'unknown' });
    setEditError(''); setEditing(true);
  };
  const saveProfile = async () => {
    if (!token || saving) return;
    if (!draft.name.trim()) { setEditError('Enter your pet name.'); return; }
    setSaving(true); setEditError('');
    try {
      const saved = await ownerCareApi.updatePet(String(pet.id), draft, token);
      setPet((current: any) => ({ ...current, ...saved })); setEditing(false);
    } catch (failure: any) { setEditError(failure.message || 'Unable to save your pet profile.'); }
    finally { setSaving(false); }
  };
  const [shares, setShares] = useState<any[]>([]);
  const [clinicActivity, setClinicActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<{ title: string; body: string } | null>(null);
  const load = useCallback(async (active: () => boolean = () => true) => {
    if (!token || !pet || uploadInProgress.current) return;
    const revision = ++profileRevision.current;
    const current = () => active() && profileRevision.current === revision;
    if (!clinicPet) {
      try {
        const saved = await petsApi.getById(String(pet.id), token);
        if (current()) { setPet({ ...saved, source: 'account' }); setError(''); }
      } catch (failure: any) { if (current()) setError(failure.message || 'Unable to refresh this profile.'); }
      return;
    }
    setLoading(true);
    try {
      const [rows, care, activity] = await Promise.all([ownerSharedRecordsApi.list(token), ownerCareApi.overview(token), ownerCareApi.medicalActivity(String(pet.id), token)]);
      if (current()) {
        const saved = care.clinicPets.find((p: any) => String(p.id) === String(pet.id));
        if (!saved) throw new Error('Pet not found in your account.');
        setPet({ ...saved, source: 'clinic' });
        setClinicActivity(activity.records);
        setShares(rows.filter((b: any) => String(b.petId) === String(pet.id)).sort((a: any,b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); setError('');
      }
    } catch (failure: any) { if (current()) setError(failure.message || 'Unable to load shared records.'); }
    finally { if (active()) setLoading(false); }
  }, [token, clinicPet, pet?.id]);
  useFocusEffect(useCallback(() => { let active = true; void load(() => active); return () => { active = false; }; }, [load]));
  useFocusEffect(useCallback(() => { StatusBar.setBarStyle('light-content'); return () => StatusBar.setBarStyle('default'); }, []));
  const s = styles(tc, isDark);
  const icon = (name: any, size = 21, color = tc.text) => <Ionicons name={name} size={size} color={color} />;
  const info = (title: string, body: string) => setSheet({ title, body });
  const main = (screen: string) => navigation.navigate('Main', { screen });
  if (!pet) return <SafeAreaView style={s.safe}><Text style={s.body}>Choose a pet from Home.</Text><TouchableOpacity onPress={() => main('Home')}><Text style={s.link}>Go to Home</Text></TouchableOpacity></SafeAreaView>;
  const records = clinicPet ? clinicActivity : shares.flatMap(bundle => bundle.records.map((record: any) => ({ ...record, sharedAt: bundle.createdAt, clinicName: bundle.clinicName, key: `${bundle.id}-${record.id}` })));
  const visit = clinicActivity.find(record => record.type === 'visit');
  const latest = clinicPet ? visit ? { records: [visit], createdAt: visit.date } : null : shares[0];
  const reminders = clinicPet ? notifications.filter(n => String(n.petId) === String(pet.id) && !n.read) : [];
  const age = pet.age ? `${pet.age} years old` : pet.birth_date ? `${Math.max(0, Math.floor((Date.now() - new Date(pet.birth_date).getTime()) / 31557600000))} years old` : 'Age not recorded';
  const photo = pet.photo_url || pet.photoUrl;
  const showRecords = () => navigation.navigate('HealthReport', { petId: pet.id, pet });
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <AppHeader title="Pet Profile" onBack={() => navigation.goBack()} />
    <View style={s.contentPanel}><ScrollView contentContainerStyle={s.container}>
      <LinearGradient colors={isDark ? [tc.surface, tc.background] : [colors.white, colors.white]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.petRow}><TouchableOpacity accessibilityLabel={photo ? 'Change pet photo' : 'Upload pet photo'} onPress={uploadPhoto} disabled={uploading} style={{ alignItems: 'center' }}><View>{photo ? <Image source={{ uri: photo }} style={s.photo} /> : <View style={s.photo}>{icon('paw-outline', 43, colors.primary)}</View>}</View>{uploading && <ActivityIndicator color={GREEN} /> }</TouchableOpacity><View style={s.petDetails}><Text style={s.petName}>{pet.name}</Text><View style={s.species}><Text style={s.speciesText}>{pet.species || 'Pet'}</Text></View><Text style={s.body}>{pet.breed || 'Breed not recorded'}</Text><Text style={s.body}>{age}{pet.sex ? ` · ${pet.sex}` : ''}</Text><Text style={s.body}>{pet.weight ? `${pet.weight} kg` : clinicPet ? pet.clinic_name : 'Weight not recorded'}</Text></View></View>
        <View style={s.actionRow}><TouchableOpacity style={s.secondaryButton} onPress={() => clinicPet ? openEdit() : navigation.navigate('PetDetails', { petId: pet.id, pet, openEdit: true })}><Text style={s.link}>Edit Profile</Text></TouchableOpacity><TouchableOpacity style={s.primaryButton} onPress={showQR} disabled={qrLoading}><View style={s.buttonContent}><Text style={s.whiteText}>{qrLoading ? 'Loading QR...' : 'Show Pet QR'}</Text></View></TouchableOpacity></View>
      </LinearGradient>
      <Text style={s.heading}>Health Overview</Text>
      <View style={s.overview}>{[{ label: 'Allergies', value: 'Not recorded' }, { label: 'Condition', value: 'Not recorded' }, { label: 'Medication', value: 'Not recorded' }, { label: 'Next Vaccine', value: 'Not recorded' }].map((item, i) => <View key={item.label} style={[s.metric, i % 2 === 1 && s.metricDivider, i >= 2 && s.metricRowDivider]}><Text style={s.metricLabel}>{item.label}</Text><Text style={s.metricValue}>{item.value}</Text></View>)}</View>
      <Text style={s.heading}>Health Records</Text>
      <View style={s.recordsCard}><View style={s.tabs}>{['overview', 'history'].map(value => <TouchableOpacity key={value} onPress={() => setTab(value)} style={[s.tab, tab === value && s.activeTab]}><Text style={tab === value ? s.whiteText : s.body}>{value === 'overview' ? 'Overview' : 'History'}</Text></TouchableOpacity>)}</View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ padding: 14 }} /> : error ? <TouchableOpacity onPress={() => load()}><Text style={s.body}>{error} Tap to retry.</Text></TouchableOpacity> : tab === 'overview' ? <TouchableOpacity style={s.latest} onPress={() => latest ? info('Latest consultation', latest.records.map((r: any) => `${r.title}\n${r.detail || ''}`).join('\n\n')) : info('Latest consultation', 'No completed clinic consultation is recorded for this pet yet.')}><View style={{ flex: 1 }}><Text style={s.bold}>Latest Consultation</Text><Text style={s.body}>{latest ? latest.records[0].title : 'No completed consultation yet'}</Text><Text style={s.small}>{latest ? dateLabel(latest.createdAt) : 'Completed visit details will appear here.'}</Text></View>{latest && <Text style={s.link}>View Details</Text>}{icon('chevron-forward', 15)}</TouchableOpacity> : records.length ? records.map(record => <TouchableOpacity key={record.key} style={s.historyRow} onPress={() => info(record.title, record.detail || 'No additional details.')}><View style={{ flex: 1 }}><Text style={s.bold}>{record.title}</Text><Text style={s.small}>{record.category} · {dateLabel(record.date || record.sharedAt)}</Text></View>{icon('chevron-forward', 17)}</TouchableOpacity>) : <Text style={[s.body, { padding: 12 }]}>No clinic health history yet.</Text>}
      </View>
      <Text style={s.heading}>Care Reminders</Text>
      {reminders.length ? reminders.map(reminder => <TouchableOpacity key={reminder.id} style={s.reminder} onPress={() => main('Alerts')}><View style={s.amberDot} /><View style={{ flex: 1 }}><Text style={s.bold}>{reminder.title}</Text><Text style={s.small}>{reminder.message}</Text></View>{icon('chevron-forward', 17)}</TouchableOpacity>) : <View style={s.reminder}><Text style={s.body}>No clinic reminders for this pet.</Text></View>}
      <TouchableOpacity style={s.fullButton} onPress={() => info('Report symptoms', 'Symptom reporting from this profile is not available yet. Contact your clinic to discuss your pet’s symptoms.')}><Text style={s.whiteText}>Report Symptoms</Text></TouchableOpacity>
      <TouchableOpacity style={s.reportButton} onPress={showRecords}><Text style={s.link}>View Complete Health Report</Text></TouchableOpacity>
      {clinicPet && <TouchableOpacity style={s.booking} onPress={() => navigation.navigate('BookAppointment', { clinicPetId: String(pet.id), clinicId: String(pet.clinic_id) })}><Text style={s.link}>Request Appointment</Text>{icon('chevron-forward', 16, colors.primary)}</TouchableOpacity>}
    </ScrollView></View>
    <View style={[s.bottomBar, { paddingBottom: Math.max(7, insets.bottom) }]}>{[{ screen: 'Home', icon: 'home', label: 'Home' }, { screen: 'Appointments', icon: 'calendar-outline', label: 'Appointments' }, { screen: 'Alerts', icon: 'notifications-outline', label: 'Alerts' }, { screen: 'Profile', icon: 'person-outline', label: 'Profile' }].map(item => <TouchableOpacity key={item.screen} style={s.bottomItem} onPress={() => main(item.screen)}><View style={[s.bottomIcon, item.screen === 'Home' && s.selectedIcon]}><NavigationIcon name={item.screen} color={item.screen === 'Home' ? GREEN : tc.text} /></View><Text style={[s.bottomLabel, item.screen === 'Home' && { color: colors.primary }]}>{item.label}</Text>{item.screen === 'Home' && <View style={s.activeUnderline} />}</TouchableOpacity>)}</View>
    <Modal visible={editing} transparent animationType="slide" onRequestClose={() => { if (!saving) setEditing(false); }}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.sheet}><View style={s.sheetHeader}><Text style={s.heading}>Edit Pet Profile</Text><TouchableOpacity accessibilityLabel="Close edit profile" disabled={saving} onPress={() => setEditing(false)} style={s.iconButton}>{icon('close', 24)}</TouchableOpacity></View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {!!editError && <Text accessibilityRole="alert" style={{ color: colors.danger, marginBottom: 12 }}>{editError}</Text>}
            {([{ key: 'name', label: 'Pet name *' }, { key: 'breed', label: 'Breed' }, { key: 'birth_date', label: 'Date of birth (YYYY-MM-DD)' }, { key: 'weight', label: 'Weight (kg)' }, { key: 'color', label: 'Color' }] as const).map(field => <View key={field.key} style={{ marginBottom: 14 }}><Text style={s.bold}>{field.label}</Text><TextInput accessibilityLabel={field.label} editable={!saving} value={draft[field.key]} onChangeText={value => setDraft(current => ({ ...current, [field.key]: value }))} keyboardType={field.key === 'weight' ? 'decimal-pad' : 'default'} maxLength={200} placeholder={field.key === 'birth_date' ? 'YYYY-MM-DD' : field.label} placeholderTextColor={tc.textMuted} style={{ borderWidth: 1, borderColor: isDark ? '#555B58' : '#E0E2E1', borderRadius: 10, padding: 13, marginTop: 6, color: tc.text, fontSize: 15, backgroundColor: tc.background }} /></View>)}
            <Text style={s.bold}>Sex</Text><View style={[s.actionRow, { marginTop: 8, marginBottom: 16 }]}>{['male','female','unknown'].map(value => <TouchableOpacity key={value} disabled={saving} onPress={() => setDraft(current => ({ ...current, sex: value }))} style={[s.secondaryButton, draft.sex === value && { backgroundColor: GREEN }]}><Text style={draft.sex === value ? s.whiteText : s.link}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}</View>
          </ScrollView>
          <TouchableOpacity disabled={saving} onPress={saveProfile} style={[s.fullButton, saving && { opacity: 0.6 }]}><Text style={s.whiteText}>{saving ? 'Saving...' : 'Save changes'}</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={!!qr} transparent animationType="fade" onRequestClose={() => setQr(null)}><View style={s.backdrop}><View style={s.sheet}><View style={s.sheetHeader}><Text style={[s.heading, { flex: 1, marginRight: 8 }]}>{pet.name} · Medical-history QR</Text><TouchableOpacity accessibilityLabel="Close pet QR" onPress={() => setQr(null)} style={s.iconButton}>{icon('close', 24)}</TouchableOpacity></View><Text style={s.body}>Ask your doctor to scan this in Patient Records. You will receive a request in Alerts to allow or decline sharing.</Text><View style={{ alignItems: 'center', padding: 20 }}>{qr && new Date(qr.expiresAt).getTime() > now ? <View style={{ backgroundColor: '#fff', padding: 16 }}><QRCode value={qr.value} size={220} /></View> : <Text style={s.bold}>This QR has expired. Generate a new code.</Text>}</View><Text style={s.small}>No medical information is stored in this QR. Your approval is required. The code expires in {qr ? Math.max(0,Math.ceil((new Date(qr.expiresAt).getTime()-now)/1000)) : 0} seconds.</Text><TouchableOpacity style={s.fullButton} disabled={qrLoading} onPress={showQR}><Text style={s.whiteText}>{qrLoading ? 'Generating...' : 'Generate new QR'}</Text></TouchableOpacity><TouchableOpacity style={s.reportButton} onPress={() => { setQr(null); main('Alerts'); }}><Text style={s.link}>View access requests</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}><View style={s.backdrop}><View style={s.sheet}><View style={s.sheetHeader}><Text style={s.heading}>{sheet?.title}</Text><TouchableOpacity accessibilityLabel="Close details" onPress={() => setSheet(null)} style={s.iconButton}>{icon('close', 24)}</TouchableOpacity></View><ScrollView><Text style={s.body}>{sheet?.body}</Text></ScrollView><TouchableOpacity style={s.fullButton} onPress={() => setSheet(null)}><Text style={s.whiteText}>Done</Text></TouchableOpacity></View></View></Modal>
  </SafeAreaView>;
}
const styles = (tc: any, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN }, contentPanel: { flex: 1, backgroundColor: dark ? tc.background : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }, container: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }, petDetails: { flex: 1, borderLeftWidth: 1, borderColor: tc.border, paddingLeft: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }, navTitle: { ...BOLD, fontSize: 20, color: '#FFFFFF', flex: 1 }, iconButton: { padding: 10 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D61B', position: 'absolute', right: 8, top: 6 },
  hero: { borderRadius: 15, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', padding: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2 }, petRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 10 }, photo: { width: 84, height: 82, borderRadius: 12, backgroundColor: dark ? tc.surface : colors.paleSage, justifyContent: 'center', alignItems: 'center' }, petName: { ...BOLD, fontSize: 19, color: tc.text }, species: { alignSelf: 'flex-start', backgroundColor: colors.eucalyptus, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginVertical: 3 }, speciesText: { ...BOLD, fontSize: 12, color: '#14211C', textTransform: 'capitalize' },
  body: { color: tc.textSecondary, fontSize: 12, lineHeight: 15 }, small: { color: tc.textSecondary, fontSize: 11, lineHeight: 15 }, bold: { ...BOLD, color: tc.text, fontSize: 14, lineHeight: 21 }, heading: { ...BOLD, color: dark ? tc.text : GREEN, fontSize: 16, lineHeight: 21, marginTop: 8, marginBottom: 5 },
  actionRow: { flexDirection: 'row', gap: 9 }, secondaryButton: { flex: 1, minHeight: 32, justifyContent: 'center', paddingVertical: 5, backgroundColor: dark ? tc.surface : colors.paleSage, borderRadius: 12, borderWidth: 1, borderColor: dark ? '#555B58' : '#D6DFD9', alignItems: 'center' }, primaryButton: { flex: 1, minHeight: 32, justifyContent: 'center', paddingVertical: 5, backgroundColor: GREEN, borderRadius: 12, alignItems: 'center' }, buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 }, link: { ...BOLD, color: dark ? tc.text : colors.deepForest, fontSize: 12, lineHeight: 17 }, whiteText: { ...BOLD, color: '#fff', fontSize: 12, lineHeight: 17 },
  overview: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', backgroundColor: tc.surface }, metric: { width: '50%', minHeight: 44, paddingHorizontal: 14, paddingVertical: 8 }, metricRowDivider: { borderTopWidth: 1, borderColor: dark ? tc.border : '#E0E2E1' }, metricDivider: { borderLeftWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1' }, metricLabel: { ...BOLD, color: tc.text, fontSize: 12, lineHeight: 14, marginBottom: 1 }, metricValue: { color: tc.textSecondary, fontSize: 12, lineHeight: 15 },
  recordsCard: { borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', borderRadius: 12, padding: 10, backgroundColor: tc.surface }, tabs: { flexDirection: 'row', borderRadius: 13, backgroundColor: dark ? tc.background : colors.paleSage, marginBottom: 7 }, tab: { flex: 1, minHeight: 35, justifyContent: 'center', paddingVertical: 7, alignItems: 'center', borderRadius: 13 }, activeTab: { backgroundColor: GREEN }, latest: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: dark ? tc.background : colors.paleSage, padding: 11, minHeight: 66, borderLeftWidth: 3, borderLeftColor: colors.primary, borderRadius: 8 }, historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1' },
  reminder: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, minHeight: 42, marginBottom: 4, backgroundColor: tc.surface }, amberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E49B16' }, fullButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: GREEN, paddingVertical: 7, borderRadius: 9, marginTop: 7 }, reportButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dark ? '#555B58' : '#C7D6CC', paddingVertical: 6, borderRadius: 9, marginTop: 6, backgroundColor: dark ? tc.surface : colors.paleSage }, booking: { minHeight: 42, flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', paddingVertical: 7 },
  bottomIcon: { width: 70, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }, selectedIcon: { backgroundColor: '#E1F3E6' }, activeUnderline: { position: 'absolute', bottom: 0, width: 60, height: 3, borderRadius: 2, backgroundColor: GREEN }, bottomBar: { flexDirection: 'row', backgroundColor: tc.surface, borderTopWidth: 1, borderColor: dark ? '#555B58' : '#E0E2E1', paddingVertical: 7 }, bottomItem: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 4 }, bottomLabel: { fontSize: 12, color: tc.textSecondary }, backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { backgroundColor: tc.surface, padding: 20, paddingBottom: 30, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%' }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
