import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Switch, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme/colors';
import { mockUser, mockClinics } from '../data/mockData';

export default function ProfileScreen({ navigation }: any) {
  const { colors: tc, isDark, toggleTheme } = useTheme();
  const { logout, userEmail, userName } = useAuth();
  const [notifModal, setNotifModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [notifs, setNotifs] = useState({ vaccination: true, appointments: true, deworming: true, outbreaks: true, tips: false });
  const [editForm, setEditForm] = useState({ name: userName || mockUser.name, email: userEmail || mockUser.email, phone: mockUser.phone || '', location: mockUser.location || '' });
  const s = styles(tc, isDark);
  const clinic = mockClinics.find(c => c.id === mockUser.selectedClinicId);

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
      <View style={[s.menuIcon, { backgroundColor: danger ? '#FEF2F2' : isDark ? '#1e3a5f' : '#EFF6FF' }]}>
        <Ionicons name={icon as any} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[s.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      {toggle ? <Switch value={value} onValueChange={toggle} trackColor={{ true: colors.primary }} thumbColor="#fff" /> : <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(userName || mockUser.name).charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{userName || mockUser.name}</Text>
          <Text style={s.email}>{userEmail || mockUser.email}</Text>
          {mockUser.location && <View style={s.locationRow}><Ionicons name="location-outline" size={14} color={tc.textMuted} /><Text style={s.location}>{mockUser.location}</Text></View>}
          <TouchableOpacity style={s.editProfileBtn} onPress={() => setEditModal(true)}>
            <Ionicons name="pencil-outline" size={14} color={colors.primary} />
            <Text style={s.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {clinic && (
          <View style={s.clinicCard}>
            <Ionicons name="medkit-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.clinicLabel}>Preferred Clinic</Text>
              <Text style={s.clinicName}>{clinic.name}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ClinicSelection')}>
              <Text style={s.changeText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={s.sectionTitle}>Preferences</Text>
        <View style={s.menuCard}>
          <MenuItem icon="notifications-outline" label="Notification Settings" onPress={() => setNotifModal(true)} />
          <MenuItem icon="moon-outline" label="Dark Mode" value={isDark} toggle={toggleTheme} />
          <MenuItem icon="shield-outline" label="Privacy Settings" onPress={() => setPrivacyModal(true)} />
        </View>

        <Text style={s.sectionTitle}>Support</Text>
        <View style={s.menuCard}>
          <MenuItem icon="help-circle-outline" label="Help & FAQ" onPress={() => setHelpModal(true)} />
          <MenuItem icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
          <MenuItem icon="information-circle-outline" label="App Version" onPress={() => Toast.show({ type: 'info', text1: 'PetWatch v1.0.0' })} />
        </View>

        <View style={s.menuCard}>
          <MenuItem icon="log-out-outline" label="Log Out" onPress={doLogout} danger />
        </View>
      </ScrollView>

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
  safe: { flex: 1, backgroundColor: tc.background },
  container: { padding: spacing.md, paddingBottom: 40 },
  profileCard: { alignItems: 'center', backgroundColor: tc.surface, borderRadius: radius.lg, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: tc.border },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: tc.text },
  email: { fontSize: 14, color: tc.textSecondary, marginTop: 2, marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  location: { fontSize: 13, color: tc.textMuted },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: tc.border, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 7 },
  editProfileText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  clinicCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF', borderRadius: radius.md, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#2563EB' : '#BFDBFE' },
  clinicLabel: { fontSize: 12, color: isDark ? '#D2E5DC' : '#087A70' },
  clinicName: { fontSize: 14, fontWeight: '600', color: isDark ? '#BFDBFE' : '#1E40AF' },
  changeText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: tc.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuCard: { backgroundColor: tc.surface, borderRadius: radius.lg, marginBottom: 16, borderWidth: 1, borderColor: tc.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: tc.border },
  menuIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
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
