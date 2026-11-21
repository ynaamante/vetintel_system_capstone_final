import AppHeader from '../components/AppHeader';
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Switch, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme/colors';
import { useFocusEffect } from '@react-navigation/native';
import { ownerCareApi } from '../services/api';

export default function ProfileScreen({ navigation }: any) {
  const { colors: tc, isDark, toggleTheme } = useTheme();
  const { logout, userEmail, userName, token } = useAuth();
  const [notifModal, setNotifModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [notifs, setNotifs] = useState({ vaccination: true, appointments: true, deworming: true, outbreaks: true, tips: false });
  const [editForm, setEditForm] = useState({ name: userName || '', email: userEmail || '', phone: '', location: '' });
  const s = styles(tc, isDark);
  const [clinics, setClinics] = useState<{id: string; name: string}[]>([]);
  const [clinicError, setClinicError] = useState('');
  const [appearanceModal, setAppearanceModal] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (token) ownerCareApi.overview(token).then(data => {
      if (!active) return;
      const linked = new Map<string, {id: string; name: string}>();
      data.clinicPets.forEach((pet: any) => { if (pet.clinic_id) linked.set(String(pet.clinic_id), {id: String(pet.clinic_id), name: pet.clinic_name}); });
      setClinics([...linked.values()]); setClinicError('');
    }).catch(() => { if (active) setClinicError('Unable to load linked clinics.'); });
    return () => { active = false; };
  }, [token]));

  const doLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { logout(); Toast.show({ type: 'success', text1: 'Logged out successfully' }); } },
    ]);
  };

  const saveProfile = () => {
    Toast.show({ type: 'success', text1: 'Profile updated!' });
    setEditModal(false);
  };

  const MenuItem = ({ icon, label, onPress, danger, value, toggle }: { icon: string; label: string; onPress?: () => void; danger?: boolean; value?: boolean; toggle?: (v: boolean) => void }) => (
    <TouchableOpacity style={s.menuItem} onPress={onPress} disabled={!!toggle}>
      <View style={s.menuIcon}>
        <Ionicons name={icon as any} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[s.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      {toggle ? <Switch value={value} onValueChange={toggle} trackColor={{ true: colors.primary }} thumbColor="#fff" /> : <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top','left','right']}><AppHeader title="Profile" home />
      <View style={s.panel}><ScrollView contentContainerStyle={s.container}>
        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={s.avatarText}>{(userName || 'Owner').split(' ').filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase()}</Text></View>
          <View style={s.accountInfo}><Text style={s.name}>{userName || 'Pet owner'}</Text><View style={s.contactRow}><Ionicons name="mail-outline" size={14} color={tc.textSecondary} /><Text style={s.email} numberOfLines={1}>{userEmail || 'Email not recorded'}</Text></View><View style={s.contactRow}><Ionicons name="call-outline" size={14} color={tc.textSecondary} /><Text style={s.email}>{editForm.phone || 'Phone not recorded'}</Text></View></View>
          <TouchableOpacity style={s.editProfileBtn} onPress={() => setEditModal(true)}><Ionicons name="pencil-outline" size={16} color="#FFFFFF" /><Text style={s.editProfileText}>Edit Profile</Text></TouchableOpacity>
        </View>
        <Text style={s.sectionTitle}>My Veterinary Clinics</Text>
        {clinics.length ? clinics.map(clinic => <View key={clinic.id} style={s.clinicCard}><View style={s.clinicIcon}><Ionicons name="paw-outline" size={27} color="#005638" /></View><View style={{flex:1}}><Text style={s.clinicName}>{clinic.name}</Text><View style={s.connected}><View style={s.connectedDot}/><Text style={s.clinicLabel}>Connected</Text></View></View><TouchableOpacity style={s.manage} onPress={() => navigation.navigate('Home', { screen: 'NearbyClinics' })}><Text style={s.changeText}>Manage</Text><Ionicons name="chevron-forward" size={17} color="#005638" /></TouchableOpacity></View>) : <TouchableOpacity style={s.clinicCard} onPress={() => navigation.navigate('Home', { screen: 'NearbyClinics' })}><Ionicons name="paw-outline" size={25} color="#005638" /><Text style={[s.menuLabel,{marginLeft:12}]}>{clinicError || 'Find a veterinary clinic'}</Text><Ionicons name="chevron-forward" size={18} color={tc.textMuted}/></TouchableOpacity>}
        <Text style={s.sectionTitle}>Account & Privacy</Text>
        <View style={s.menuCard}><MenuItem icon="person-outline" label="Personal & Contact Information" onPress={() => setEditModal(true)} /><MenuItem icon="notifications-outline" label="Notification Preferences" onPress={() => setNotifModal(true)} /><MenuItem icon="shield-checkmark-outline" label="Privacy & Sharing Permissions" onPress={() => setPrivacyModal(true)} /><MenuItem icon="receipt-outline" label="Billing History" onPress={() => Toast.show({type:'info',text1:'Billing history',text2:'Contact your clinic for billing records.'})} /></View>
        <Text style={s.sectionTitle}>Preferences & Support</Text>
        <View style={s.menuCard}><MenuItem icon="moon-outline" label="Appearance" onPress={() => setAppearanceModal(true)} /><MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => setHelpModal(true)} /><MenuItem icon="information-circle-outline" label="About" onPress={() => Toast.show({type:'info',text1:'PetWatch v1.0.0'})} /></View>
        <TouchableOpacity style={s.signOut} onPress={doLogout}><Ionicons name="log-out-outline" size={22} color={colors.danger}/><Text style={s.signOutText}>Sign Out</Text></TouchableOpacity>
      </ScrollView></View>
      <Modal visible={appearanceModal} transparent animationType="slide" onRequestClose={() => setAppearanceModal(false)}><View style={s.modalOverlay}><View style={s.modalBox}><Text style={s.modalTitle}>Appearance</Text><View style={s.notifRow}><Text style={s.notifLabel}>Dark mode</Text><Switch value={isDark} onValueChange={toggleTheme} trackColor={{true:colors.primary}} /></View><TouchableOpacity style={s.modalBtn} onPress={() => setAppearanceModal(false)}><Text style={s.modalBtnText}>Done</Text></TouchableOpacity></View></View></Modal>

      {/* Notification Modal */}
      <Modal visible={notifModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Notification Settings</Text>
            {([
              { key: 'vaccination', label: 'Vaccination reminders' },
              { key: 'appointments', label: 'Appointment reminders' },
              { key: 'deworming', label: 'Deworming reminders' },
              { key: 'outbreaks', label: 'Disease outbreak alerts' },
              { key: 'tips', label: 'Health tips' },
            ] as { key: keyof typeof notifs; label: string }[]).map(n => (
              <View key={n.key} style={s.notifRow}>
                <Text style={s.notifLabel}>{n.label}</Text>
                <Switch value={notifs[n.key]} onValueChange={v => setNotifs(p => ({ ...p, [n.key]: v }))} trackColor={{ true: colors.primary }} thumbColor="#fff" />
              </View>
            ))}
            <TouchableOpacity style={s.modalBtn} onPress={() => { setNotifModal(false); Toast.show({ type: 'success', text1: 'Preferences saved!' }); }}>
              <Text style={s.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={privacyModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Privacy Settings</Text>
            <Text style={s.modalBody}>Your pet health data is stored securely on your device. PetWatch does not share your personal information with third parties without your consent.</Text>
            <TouchableOpacity style={[s.outlineBtn, { marginBottom: 10 }]}><Text style={s.outlineBtnText}>Download My Data</Text></TouchableOpacity>
            <TouchableOpacity style={[s.dangerBtn]}><Text style={s.dangerBtnText}>Delete All Data</Text></TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => setPrivacyModal(false)}><Text style={s.modalCancelText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal visible={helpModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Help & FAQ</Text>
            {[
              { q: 'How do I add a pet?', a: 'Go to Home and tap "Add Pet" or use the quick action card.' },
              { q: 'How are vaccination reminders sent?', a: 'PetWatch sends push notifications 30 days before a vaccine is due.' },
              { q: 'Can I track multiple pets?', a: 'Yes! You can add as many pets as you need.' },
              { q: 'Is my data backed up?', a: 'Data is stored locally. Export your health reports to share with your vet.' },
            ].map((item, i) => (
              <View key={i} style={s.faqItem}>
                <Text style={s.faqQ}>{item.q}</Text>
                <Text style={s.faqA}>{item.a}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.modalBtn} onPress={() => setHelpModal(false)}><Text style={s.modalBtnText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            {(['name', 'email', 'phone', 'location'] as const).map(field => (
              <View key={field}>
                <Text style={s.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                <TextInput style={s.input} value={editForm[field]} onChangeText={v => setEditForm(p => ({ ...p, [field]: v }))} placeholderTextColor={tc.textMuted} />
              </View>
            ))}
            <View style={s.editBtns}>
              <TouchableOpacity style={s.outlineBtn} onPress={() => setEditModal(false)}><Text style={s.outlineBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.modalBtn} onPress={saveProfile}><Text style={s.modalBtnText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#005638' }, panel: { flex: 1, backgroundColor: isDark ? tc.background : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }, accountInfo: { flex: 1, borderLeftWidth: 1, borderColor: tc.border, paddingLeft: 12 }, contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }, clinicIcon: { width: 50, height: 50, borderRadius: 11, backgroundColor: '#E1F3E6', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, connected: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#E1F3E6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }, connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#005638' }, manage: { flexDirection: 'row', alignItems: 'center', gap: 6, borderLeftWidth: 1, borderColor: tc.border, paddingLeft: 12, marginLeft: 8 }, signOut: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, backgroundColor: isDark ? tc.surface : '#FFF0F0', marginTop: 30 }, signOutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  container: { padding: 10, paddingTop: 14, paddingBottom: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: tc.surface, borderRadius: 13, padding: 16, minHeight: 104, marginBottom: 16, borderWidth: 1, borderColor: isDark ? tc.border : '#E5E7E5' },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  avatarText: { fontSize: 21, fontWeight: '700', color: '#fff' },
  name: { fontSize: 19, fontWeight: '700', color: tc.text },
  email: { flexShrink: 1, fontSize: 13, color: tc.textSecondary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  location: { fontSize: 13, color: tc.textMuted },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: tc.border, backgroundColor: '#005638', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 10 },
  editProfileText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
  clinicCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: tc.surface, borderRadius: radius.md, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: isDark ? tc.border : '#E5E7E5' },
  clinicLabel: { fontSize: 12, color: isDark ? '#D2E5DC' : '#087A70' },
  clinicName: { fontSize: 15, fontWeight: '600', color: tc.text },
  changeText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: isDark ? tc.text : '#005638', marginBottom: 6, marginLeft: 4 },
  menuCard: { backgroundColor: tc.surface, borderRadius: radius.lg, marginBottom: 16, borderWidth: 1, borderColor: tc.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, minHeight: 48, borderBottomWidth: 1, borderBottomColor: tc.border },
  menuIcon: { width: 26, height: 24, borderRadius: 0, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 15, color: tc.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: tc.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: tc.text, marginBottom: 16 },
  modalBody: { fontSize: 14, color: tc.textSecondary, lineHeight: 20, marginBottom: 16 },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  notifLabel: { fontSize: 15, color: tc.text },
  faqItem: { marginBottom: 14 },
  faqQ: { fontSize: 14, fontWeight: '700', color: tc.text, marginBottom: 4 },
  faqA: { fontSize: 13, color: tc.textSecondary, lineHeight: 18 },
  modalBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  outlineBtn: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  outlineBtnText: { fontSize: 14, color: tc.text },
  dangerBtn: { borderWidth: 1, borderColor: '#FECACA', borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { fontSize: 14, color: colors.danger },
  modalCancel: { alignItems: 'center', marginTop: 14 },
  modalCancelText: { fontSize: 14, color: tc.textSecondary },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg, marginBottom: 12 },
  editBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
