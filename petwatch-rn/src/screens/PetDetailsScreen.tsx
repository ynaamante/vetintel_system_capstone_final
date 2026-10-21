import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, TextInput, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { format, parseISO } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ownerSharedRecordsApi } from '../services/api';
import { colors, spacing, radius } from '../theme/colors';
import { mockPets, mockVaccinations, mockSymptoms, mockClinics, mockUser } from '../data/mockData';
type SharedRecordBundle = {
  id: string;
  petName: string;
  clinicName: string;
  createdAt: string;
  message?: string;
  records: { id: string; category: string; title: string; detail: string; date?: string; clinicVerified?: boolean; verifiedBy?: string | null; verifiedAt?: string | null }[];
};

export default function PetDetailsScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { colors: tc, isDark } = useTheme();
  const { token } = useAuth();
  const pet = mockPets.find(p => p.id === petId);
  const vacs = mockVaccinations.filter(v => v.petId === petId);
  const symptoms = mockSymptoms.filter(s => s.petId === petId);
  const clinic = mockClinics.find(c => c.id === mockUser.selectedClinicId);
  const [showQR, setShowQR] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [sharedRecordBundles, setSharedRecordBundles] = useState<SharedRecordBundle[]>([]);
  const [sharedRecordsLoading, setSharedRecordsLoading] = useState(true);
  const [sharedRecordsError, setSharedRecordsError] = useState('');
  const [sharedRecordsRetry, setSharedRecordsRetry] = useState(0);
  const [petData, setPetData] = useState({ name: pet?.name || '', breed: pet?.breed || '', age: String(pet?.age || ''), weight: String(pet?.weight || ''), color: pet?.color || '' });
  const s = styles(tc, isDark);
  useEffect(() => {
    let active = true;
    if (!token || !pet?.name) {
      setSharedRecordBundles([]);
      setSharedRecordsLoading(false);
      setSharedRecordsError(token ? '' : 'Sign in to view records shared by your clinic.');
      return () => { active = false; };
    }
    setSharedRecordsLoading(true);
    setSharedRecordsError('');
    ownerSharedRecordsApi.list(token)
      .then((bundles: SharedRecordBundle[]) => {
        if (!Array.isArray(bundles)) throw new Error('The shared records response was not valid.');
        if (active) {
          setSharedRecordBundles(bundles.filter(bundle => (
            bundle.petName?.trim().toLowerCase() === pet.name.trim().toLowerCase()
          )));
        }
      })
      .catch((error: Error) => {
        if (active) setSharedRecordsError(error.message || 'Unable to load clinic-shared records.');
      })
      .finally(() => {
        if (active) setSharedRecordsLoading(false);
      });
    return () => { active = false; };
  }, [token, pet?.name, sharedRecordsRetry]);
  if (!pet) return <SafeAreaView style={s.safe}><View style={s.center}><Text style={{ color: tc.text }}>Pet not found</Text></View></SafeAreaView>;
  const upcomingVacs = vacs.filter(v => v.status === 'upcoming');
  const qrData = JSON.stringify({ name: pet.name, species: pet.species, breed: pet.breed, owner: mockUser.name, phone: mockUser.phone, clinic: clinic?.name });
  const DOG = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&q=80';
  const CAT = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&q=80';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}><TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={tc.text} /></TouchableOpacity><Text style={s.navTitle}>Pet Profile</Text><View style={{ width: 40 }} /></View>
      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity style={s.emergencyBtn} onPress={() => clinic ? Linking.openURL(`tel:${clinic.phone}`) : Alert.alert('No clinic selected')}>
          <Ionicons name="call" size={20} color="#fff" /><Text style={s.emergencyBtnText}>Emergency: Call {clinic?.name || 'Vet Clinic'}</Text>
        </TouchableOpacity>
        <View style={s.profileCard}>
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 14 }}>
            <Image source={{ uri: pet.species === 'dog' ? DOG : CAT }} style={s.petImg} />
            <View style={{ flex: 1 }}>
              <Text style={s.petName}>{pet.name}</Text>
              <View style={s.speciesBadge}><Text style={s.speciesText}>{pet.species}</Text></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[['Breed', pet.breed], ['Age', `${pet.age} yrs`], ['Weight', `${pet.weight} kg`], ['Color', pet.color]].map(([k, v]) => (
                  <View key={k} style={{ width: '50%', marginBottom: 6 }}><Text style={s.infoLabel}>{k}</Text><Text style={s.infoVal}>{v}</Text></View>
                ))}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={s.outlineBtn} onPress={() => setEditModal(true)}><Ionicons name="create-outline" size={16} color={tc.text} /><Text style={s.outlineBtnText}>Edit</Text></TouchableOpacity>
            <TouchableOpacity style={s.outlineBtn} onPress={() => setShowQR(true)}><Ionicons name="qr-code-outline" size={16} color={tc.text} /><Text style={s.outlineBtnText}>QR Code</Text></TouchableOpacity>
          </View>
        </View>
        {pet.nextDewormingDate && (
          <View style={s.dewormCard}><View style={s.dewormIcon}><Ionicons name="medical-outline" size={20} color={colors.secondary} /></View><View style={{ flex: 1 }}><Text style={s.dewormTitle}>Deworming Schedule</Text><Text style={s.dewormSub}>Next: {format(parseISO(pet.nextDewormingDate), 'MMMM dd, yyyy')}</Text></View></View>
        )}
        <TouchableOpacity style={s.reportBanner} onPress={() => navigation.navigate('HealthReport', { petId })}>
          <View style={s.reportIcon}><Ionicons name="document-text" size={24} color="#fff" /></View>
          <View style={{ flex: 1 }}><Text style={s.reportTitle}>Send Health Report to Vet</Text><Text style={s.reportSub}>Share medical history with {clinic?.name || 'your vet'}</Text></View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.quickGrid}>
          {[{ icon: 'alert-circle-outline', label: 'Report Symptoms', c: colors.warning, route: 'ReportSymptoms', p: { petId } },
            { icon: 'medical-outline', label: 'Vaccinations', c: colors.primary, route: 'Vaccinations', p: { petId } },
            { icon: 'pulse-outline', label: 'Health History', c: colors.success, route: 'HealthHistory', p: { petId } },
            { icon: 'calendar-outline', label: 'Appointments', c: colors.secondary, route: 'Appointments', p: undefined }].map(item => (
            <TouchableOpacity key={item.label} style={s.quickCard} onPress={() => navigation.navigate(item.route, item.p)} activeOpacity={0.7}>
              <Ionicons name={item.icon as any} size={28} color={item.c} /><Text style={s.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Shared by your clinic</Text>
            {sharedRecordsError ? (
              <TouchableOpacity onPress={() => setSharedRecordsRetry(value => value + 1)}>
                <Text style={s.seeAll}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {sharedRecordsLoading ? (
            <Text style={s.sharedRecordsHint}>Loading records shared by your clinic…</Text>
          ) : sharedRecordsError ? (
            <Text style={s.sharedRecordsHint}>{sharedRecordsError}</Text>
          ) : sharedRecordBundles.length ? sharedRecordBundles.map(bundle => (
            <View key={bundle.id} style={s.sharedBundle}>
              <Text style={s.sharedClinic}>{bundle.clinicName} · {format(parseISO(bundle.createdAt), 'MMM dd, yyyy')}</Text>
              {bundle.message ? <Text style={s.sharedMessage}>{bundle.message}</Text> : null}
              {bundle.records.map(item => (
                <View key={item.id} style={s.sharedRecord}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sharedRecordCategory}>{item.category}</Text>
                    <Text style={s.sharedRecordTitle}>{item.title}</Text>
                    {item.category === 'Vaccine' && item.clinicVerified && (
                      <View style={s.sharedVerifiedBadge}>
                        <Ionicons name="shield-checkmark" size={13} color="#087f65" />
                        <Text style={s.sharedVerifiedText}>Clinic Verified</Text>
                      </View>
                    )}
                    {item.detail ? <Text style={s.sharedRecordsHint}>{item.detail}</Text> : null}
                    {item.category === 'Vaccine' && item.clinicVerified && item.verifiedBy ? <Text style={s.sharedVerifiedBy}>Verified by {item.verifiedBy}{item.verifiedAt ? ` · ${new Date(item.verifiedAt).toLocaleDateString()}` : ''}</Text> : null}
                    {item.date ? <Text style={s.sharedRecordDate}>{new Date(item.date).toLocaleDateString()}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )) : (
            <Text style={s.sharedRecordsHint}>Your clinic has not shared any records for {pet.name} yet.</Text>
          )}
        </View>
        {upcomingVacs.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Upcoming Vaccinations</Text><TouchableOpacity onPress={() => navigation.navigate('Vaccinations', { petId })}><Text style={s.seeAll}>View All</Text></TouchableOpacity></View>
            {upcomingVacs.map(v => (
              <View key={v.id} style={s.vacRow}><Ionicons name="medical" size={18} color={colors.warning} /><View style={{ flex: 1, marginLeft: 10 }}><Text style={s.vacName}>{v.vaccine}</Text><Text style={s.vacDate}>Due: {format(parseISO(v.nextDue), 'MMM dd, yyyy')}</Text></View></View>
            ))}
          </View>
        )}
        {symptoms.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>Recent Symptoms</Text><TouchableOpacity onPress={() => navigation.navigate('HealthHistory', { petId })}><Text style={s.seeAll}>View All</Text></TouchableOpacity></View>
            {symptoms.slice(0, 3).map(sym => {
              const rc = sym.riskLevel === 'high' ? { bg: '#FEF2F2', border: '#FECACA', badge: colors.danger } : sym.riskLevel === 'moderate' ? { bg: '#FFF7ED', border: '#FED7AA', badge: colors.warning } : { bg: '#EFF6FF', border: '#BFDBFE', badge: colors.primary };
              return (
                <View key={sym.id} style={[s.symRow, { backgroundColor: rc.bg, borderColor: rc.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={s.symSymptoms}>{sym.symptoms.join(', ')}</Text>
                    <View style={[s.badge, { backgroundColor: rc.badge }]}><Text style={s.badgeText}>{sym.riskLevel}</Text></View>
                  </View>
                  <Text style={s.symDesc}>{sym.description}</Text>
                  <Text style={s.symDate}>{format(parseISO(sym.date), 'MMM dd, yyyy')}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Modal visible={showQR} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.qrBox}>
            <Text style={s.modalTitle}>{pet.name}'s QR Code</Text>
            <Text style={s.modalSub}>Scan to view vaccination and medical history</Text>
            <View style={s.qrWrap}><QRCode value={qrData} size={200} /></View>
            <Text style={s.qrName}>{pet.name}</Text><Text style={s.qrBreed}>{pet.breed}</Text><Text style={s.qrOwner}>Owner: {mockUser.name}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setShowQR(false)}><Text style={s.primaryBtnText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.editBox}>
            <Text style={s.modalTitle}>Edit Pet Profile</Text>
            <ScrollView>
              {[['Name', 'name'], ['Breed', 'breed'], ['Age (years)', 'age'], ['Weight (kg)', 'weight'], ['Color', 'color']].map(([label, key]) => (
                <View key={key} style={{ marginBottom: 14 }}>
                  <Text style={s.label}>{label}</Text>
                  <TextInput style={s.input} value={(petData as any)[key]} onChangeText={v => setPetData(p => ({ ...p, [key]: v }))} placeholderTextColor={tc.textMuted} />
                </View>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.outlineBtn} onPress={() => setEditModal(false)}><Text style={s.outlineBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={() => { Toast.show({ type: 'success', text1: 'Profile updated!' }); setEditModal(false); }}><Text style={s.primaryBtnText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: tc.text },
  container: { padding: spacing.md, paddingBottom: 40 },
  emergencyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 14, marginBottom: 16 },
  emergencyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  profileCard: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: tc.border },
  petImg: { width: 80, height: 80, borderRadius: 40, backgroundColor: tc.border },
  petName: { fontSize: 20, fontWeight: '700', color: tc.text, marginBottom: 6 },
  speciesBadge: { backgroundColor: tc.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  speciesText: { fontSize: 12, color: tc.textSecondary, textTransform: 'capitalize' },
  infoLabel: { fontSize: 12, color: tc.textSecondary },
  infoVal: { fontSize: 14, fontWeight: '600', color: tc.text },
  outlineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingVertical: 10 },
  outlineBtnText: { fontSize: 14, color: tc.text },
  dewormCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2E1065' : '#F5F3FF', borderWidth: 1, borderColor: isDark ? '#7C3AED' : '#DDD6FE', borderRadius: radius.md, padding: 14, marginBottom: 14, gap: 12 },
  dewormIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#4C1D95' : '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  dewormTitle: { fontSize: 15, fontWeight: '600', color: isDark ? '#C4B5FD' : '#5B21B6' },
  dewormSub: { fontSize: 13, color: isDark ? '#A78BFA' : '#7C3AED' },
  reportBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 16, marginBottom: 16, gap: 12, backgroundColor: colors.primary },
  reportIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  reportTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  reportSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  quickCard: { width: '47%', backgroundColor: tc.surface, borderRadius: radius.md, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: tc.border, gap: 8 },
  quickLabel: { fontSize: 13, fontWeight: '500', color: tc.text, textAlign: 'center' },
  section: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: tc.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tc.text },
  seeAll: { fontSize: 14, color: colors.primary },
  sharedBundle: { padding: 12, marginBottom: 10, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, backgroundColor: tc.background },
  sharedClinic: { marginBottom: 7, color: colors.primary, fontSize: 12, fontWeight: '600' },
  sharedMessage: { marginBottom: 8, color: tc.text, fontSize: 13, lineHeight: 18 },
  sharedRecord: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: tc.border },
  sharedRecordCategory: { marginBottom: 2, color: tc.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  sharedRecordTitle: { color: tc.text, fontSize: 14, fontWeight: '600' },
  sharedVerifiedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6, borderRadius: 99, backgroundColor: '#E5F7F1' },
  sharedVerifiedText: { color: '#087f65', fontSize: 11, fontWeight: '700' },
  sharedVerifiedBy: { marginTop: 4, color: tc.textSecondary, fontSize: 11 },
  sharedRecordDate: { marginTop: 3, color: tc.textMuted, fontSize: 11 },
  sharedRecordsHint: { color: tc.textSecondary, fontSize: 12, lineHeight: 17 },
  vacRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FED7AA' },
  vacName: { fontSize: 14, fontWeight: '600', color: '#9A3412' },
  vacDate: { fontSize: 12, color: '#C2410C' },
  symRow: { borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1 },
  symSymptoms: { fontSize: 14, fontWeight: '600', color: tc.text, flex: 1 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  symDesc: { fontSize: 13, color: tc.textSecondary, marginBottom: 4 },
  symDate: { fontSize: 12, color: tc.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrBox: { backgroundColor: tc.surface, borderRadius: radius.xl, padding: 24, alignItems: 'center', width: '100%', maxWidth: 360 },
  qrWrap: { backgroundColor: '#fff', padding: 16, borderRadius: radius.md, marginVertical: 16, borderWidth: 2, borderColor: tc.border },
  qrName: { fontSize: 16, fontWeight: '700', color: tc.text },
  qrBreed: { fontSize: 14, color: tc.textSecondary },
  qrOwner: { fontSize: 13, color: tc.textMuted, marginTop: 4, marginBottom: 16 },
  editBox: { backgroundColor: tc.surface, borderRadius: radius.xl, padding: 24, width: '100%', maxWidth: 400, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: tc.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: tc.textSecondary, marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
