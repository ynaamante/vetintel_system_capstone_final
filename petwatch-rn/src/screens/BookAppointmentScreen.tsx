import AppHeader from '../components/AppHeader';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { ownerCareApi } from '../services/api';

const TYPES = ['General Checkup', 'Vaccination', 'Dental Cleaning', 'Deworming', 'Surgery Consultation', 'Emergency'];
const TIMES = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
const STEPS = ['Select Pet', 'Choose Clinic', 'Appointment Details', 'Confirm'];

export default function BookAppointmentScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { colors: tc, isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [petId, setPetId] = useState(route?.params?.clinicPetId || '');
  const [clinicId, setClinicId] = useState(route?.params?.clinicId || '');
  const [type, setType] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [typeModal, setTypeModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const s = styles(tc, isDark);

  const load = async () => {
    if (!token) return;
    setLoading(true); setError('');
    try { const data = await ownerCareApi.overview(token); setPets(data.clinicPets.map((p: any) => ({ ...p, id: String(p.id), clinic_id: String(p.clinic_id) }))); }
    catch (failure: any) { setError(failure.message || 'Unable to load clinic patients.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);
  const pet = pets.find(p => p.id === petId);
  const clinics = pet ? [{ id: pet.clinic_id, name: pet.clinic_name }] : [];
  const clinic = clinics.find(c => c.id === clinicId);

  const canNext = () => {
    if (step === 0) return !!pet && !loading;
    if (step === 1) return !!clinic;
    if (step === 2) return !!type && !!date && !!time;
    return true;
  };

  const next = () => { if (step < 3) setStep(s => s + 1); };
  const back = () => { if (step > 0) setStep(s => s - 1); else navigation.goBack(); };

  const confirm = async () => {
    if (!token || saving || !pet || !clinic) return;
    const match = time.match(/^(\d+):(\d+) (AM|PM)$/);
    const start = new Date(date + 'T00:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match || !Number.isFinite(start.getTime()) || start.getFullYear() !== Number(date.slice(0,4)) || start.getMonth()+1 !== Number(date.slice(5,7)) || start.getDate() !== Number(date.slice(8,10))) {
      setError('Enter a valid date in YYYY-MM-DD format.'); return;
    }
    start.setHours(Number(match[1]) % 12 + (match[3] === 'PM' ? 12 : 0), Number(match[2]), 0, 0);
    if (start.getTime() <= Date.now()) { setError('Choose a future date and time.'); return; }
    setSaving(true); setError('');
    try {
      await ownerCareApi.book({ pet_id: petId, clinic_id: clinicId, start_time: start.toISOString(), reason: type, notes }, token);
      Toast.show({ type: 'success', text1: 'Request sent to your clinic', text2: 'Awaiting clinic confirmation.' });
      navigation.navigate('Main', { screen: 'Appointments' });
    } catch (failure: any) { setError(failure.message || 'Unable to send request.'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <AppHeader title="Book Appointment" onBack={back} />

      <View style={s.stepperRow}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <View style={s.stepItem}>
              <View style={[s.stepDot, i <= step && { backgroundColor: colors.primary }]}>
                {i < step ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[s.stepNum, i <= step && { color: '#fff' }]}>{i + 1}</Text>}
              </View>
              <Text style={[s.stepLabel, i === step && { color: colors.primary, fontWeight: '600' }]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[s.stepLine, i < step && { backgroundColor: colors.primary }]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {!!error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
        {loading && <Text style={s.optSub}>Loading clinic patients...</Text>}
        {!loading && !pets.length && <View style={s.formCard}><Text style={s.optTitle}>No linked clinic patients yet</Text><Text style={s.optSub}>Ask your clinic to register your pet using your account email. Your personal pet profile is separate from the clinic patient record.</Text><TouchableOpacity onPress={load}><Text style={{ color: colors.primary, marginTop: 12 }}>Retry</Text></TouchableOpacity></View>}
        {step === 0 && (
          <View>
            <Text style={s.stepTitle}>Which pet is this for?</Text>
            {pets.map(p => (
              <TouchableOpacity key={p.id} style={[s.optCard, petId === p.id && s.optCardActive]} onPress={() => { setPetId(p.id); setClinicId(p.clinic_id); }}>
                <View style={[s.petAvatar, { backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF' }]}>
                  <Ionicons name="paw" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.optTitle}>{p.name}</Text>
                  <Text style={s.optSub}>{p.breed} · {p.clinic_name}</Text>
                </View>
                {petId === p.id && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={s.stepTitle}>Choose a clinic</Text>
            {clinics.map(c => (
              <TouchableOpacity key={c.id} style={[s.optCard, clinicId === c.id && s.optCardActive]} onPress={() => setClinicId(c.id)}>
                <View style={[s.clinicIcon, { backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF' }]}>
                  <Ionicons name="location" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.optTitle}>{c.name}</Text>
                  <Text style={s.optSub}>Clinic where this pet is registered</Text>
                </View>
                {clinicId === c.id && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={s.stepTitle}>Appointment details</Text>
            <View style={s.formCard}>
              <Text style={s.label}>Appointment Type *</Text>
              <TouchableOpacity style={s.picker} onPress={() => setTypeModal(true)}>
                <Text style={[s.pickerText, !type && { color: tc.textMuted }]}>{type || 'Select type...'}</Text>
                <Ionicons name="chevron-down" size={16} color={tc.textMuted} />
              </TouchableOpacity>

              <Text style={s.label}>Date * (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="2026-07-15" placeholderTextColor={tc.textMuted} />

              <Text style={s.label}>Requested time * (subject to clinic confirmation)</Text>
              <TouchableOpacity style={s.picker} onPress={() => setTimeModal(true)}>
                <Text style={[s.pickerText, !time && { color: tc.textMuted }]}>{time || 'Select time...'}</Text>
                <Ionicons name="chevron-down" size={16} color={tc.textMuted} />
              </TouchableOpacity>

              <Text style={s.label}>Notes (optional)</Text>
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Any special concerns..." placeholderTextColor={tc.textMuted} multiline />
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={s.stepTitle}>Confirm your appointment</Text>
            <View style={s.confirmCard}>
              <View style={s.confirmRow}><Ionicons name="paw" size={18} color={colors.primary} /><Text style={s.confirmLabel}>Pet</Text><Text style={s.confirmVal}>{pet?.name}</Text></View>
              <View style={s.confirmRow}><Ionicons name="location-outline" size={18} color={colors.primary} /><Text style={s.confirmLabel}>Clinic</Text><Text style={s.confirmVal}>{clinic?.name}</Text></View>
              <View style={s.confirmRow}><Ionicons name="medical-outline" size={18} color={colors.primary} /><Text style={s.confirmLabel}>Type</Text><Text style={s.confirmVal}>{type}</Text></View>
              <View style={s.confirmRow}><Ionicons name="calendar-outline" size={18} color={colors.primary} /><Text style={s.confirmLabel}>Date</Text><Text style={s.confirmVal}>{date}</Text></View>
              <View style={s.confirmRow}><Ionicons name="time-outline" size={18} color={colors.primary} /><Text style={s.confirmLabel}>Time</Text><Text style={s.confirmVal}>{time}</Text></View>
              {notes ? <View style={s.confirmRow}><Ionicons name="document-text-outline" size={18} color={colors.primary} /><Text style={s.confirmLabel}>Notes</Text><Text style={[s.confirmVal, { flex: 1 }]}>{notes}</Text></View> : null}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step < 3
          ? <TouchableOpacity style={[s.nextBtn, !canNext() && { opacity: 0.5 }]} onPress={next} disabled={!canNext()}>
              <Text style={s.nextBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          : <TouchableOpacity style={[s.nextBtn, saving && { opacity: 0.5 }]} onPress={confirm} disabled={saving}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={s.nextBtnText}>{saving ? 'Sending...' : 'Request appointment'}</Text>
            </TouchableOpacity>
        }
      </View>

      <Modal visible={typeModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Type</Text>
            {TYPES.map(t => (
              <TouchableOpacity key={t} style={s.modalOption} onPress={() => { setType(t); setTypeModal(false); }}>
                <Text style={[s.modalOptionText, type === t && { color: colors.primary, fontWeight: '600' }]}>{t}</Text>
                {type === t && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalCancel} onPress={() => setTypeModal(false)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={timeModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Time</Text>
            {TIMES.map(t => (
              <TouchableOpacity key={t} style={s.modalOption} onPress={() => { setTime(t); setTimeModal(false); }}>
                <Text style={[s.modalOptionText, time === t && { color: colors.primary, fontWeight: '600' }]}>{t}</Text>
                {time === t && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalCancel} onPress={() => setTimeModal(false)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
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
  stepperRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 16 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: tc.border, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 12, color: tc.textMuted, fontWeight: '600' },
  stepLabel: { fontSize: 10, color: tc.textMuted, textAlign: 'center', maxWidth: 60 },
  stepLine: { flex: 1, height: 2, backgroundColor: tc.border, marginBottom: 16 },
  container: { padding: spacing.md, paddingBottom: 24 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: tc.text, marginBottom: 16 },
  optCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: tc.border },
  optCardActive: { borderColor: colors.primary, backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF' },
  petAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  clinicIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 15, fontWeight: '600', color: tc.text },
  optSub: { fontSize: 13, color: tc.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 12, color: tc.textSecondary },
  formCard: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: tc.border },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6, marginTop: 4 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, marginBottom: 8, backgroundColor: tc.inputBg },
  pickerText: { fontSize: 15, color: tc.text },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg, marginBottom: 8 },
  confirmCard: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: tc.border },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  confirmLabel: { fontSize: 14, color: tc.textSecondary, width: 60 },
  confirmVal: { fontSize: 14, fontWeight: '600', color: tc.text },
  footer: { padding: spacing.md, paddingBottom: 24, borderTopWidth: 1, borderTopColor: tc.border },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: tc.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: tc.text, marginBottom: 16 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tc.border },
  modalOptionText: { fontSize: 15, color: tc.text },
  modalCancel: { marginTop: 16, alignItems: 'center' },
  modalCancelText: { fontSize: 15, color: tc.textSecondary },
});
