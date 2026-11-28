import MobileSelect from '../components/MobileSelect';
import AppHeader from '../components/AppHeader';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFonts } from 'expo-font';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { ownerCareApi } from '../services/api';

const TYPES = ['General Checkup', 'Vaccination', 'Dental Cleaning', 'Deworming', 'Surgery Consultation', 'Emergency'];
const STEPS = ['Select Pet', 'Choose Clinic', 'Visit Details', 'Review'];

export default function BookAppointmentScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const [petSearch, setPetSearch] = useState('');
  const [clinicSearch, setClinicSearch] = useState('');
  const [fontLoaded] = useFonts({ VetIntelBookingBold: require('../assets/fonts/Lato-Bold.ttf') });
  const bold = { fontFamily: fontLoaded ? 'VetIntelBookingBold' : undefined, fontWeight: fontLoaded ? 'normal' as const : '700' as const };
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { colors: tc, isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [petId, setPetId] = useState(String(route?.params?.clinicPetId || ''));
  const [clinicId, setClinicId] = useState(String(route?.params?.clinicId || ''));
  const [type, setType] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<{ start_time: string; label: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slotsRefresh, setSlotsRefresh] = useState(0);
  const [notes, setNotes] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [dateModal, setDateModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const s = styles(tc, isDark);

  const load = async () => {
    if (!token) return;
    setLoading(true); setError('');
    try { const data = await ownerCareApi.overview(token); setPets(data.clinicPets.map((p: any) => ({ ...p, id: String(p.id), clinic_id: String(p.clinic_id) }))); }
    catch (failure: any) { setError(failure.message || 'Unable to load clinic patients.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);
  const query = petSearch.trim().toLowerCase();
  const filteredPets = pets.filter(p => [p.name, p.species, p.breed, p.clinic_name].filter(Boolean).join(' ').toLowerCase().includes(query));
  const pet = pets.find(p => p.id === petId);
  const clinics = pet ? [{ id: pet.clinic_id, name: pet.clinic_name, address: pet.clinic_address }] : [];
  const clinicQuery = clinicSearch.trim().toLowerCase();
  const filteredClinics = clinics.filter(c => [c.name, c.address].filter(Boolean).join(' ').toLowerCase().includes(clinicQuery));
  const clinic = clinics.find(c => c.id === clinicId);

  useEffect(() => {
    let active = true;
    let fetching = false;
    setAvailableSlots([]); setTime(''); setSlotsError('');
    if (!token || !petId || !clinicId || !date) { setSlotsLoading(false); return; }
    const refresh = async () => {
      if (fetching) return;
      fetching = true; setSlotsLoading(true);
      try {
        const result = await ownerCareApi.availability(petId, clinicId, date, token);
        if (active) {
          setAvailableSlots(result.slots); setSlotsError('');
          setTime(current => result.slots.some(slot => slot.label === current) ? current : '');
        }
      } catch (failure: any) {
        if (active) { setAvailableSlots([]); setTime(''); setSlotsError(failure.message || 'Unable to load available times.'); }
      } finally { fetching = false; if (active) setSlotsLoading(false); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    return () => { active = false; clearInterval(timer); };
  }, [token,petId,clinicId,date,slotsRefresh]);

  const localDate = (value: Date) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  const today = localDate(new Date());
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarDays = [...Array(calendarMonth.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const preferredStart = () => {
    const slot = availableSlots.find(item => item.label === time);
    return slot ? new Date(slot.start_time) : null;
  };
  const canNext = () => {
    if (step === 0) return !!pet && !loading;
    if (step === 1) return !!clinic;
    if (step === 2) return !slotsLoading && !slotsError && !!type && !!visitReason.trim() && !!preferredStart() && preferredStart()!.getTime() > Date.now();
    return true;
  };

  const next = () => { if (step < 3) setStep(s => s + 1); };
  const back = () => { if (step > 0) setStep(s => s - 1); else navigation.goBack(); };

  const confirm = async () => {
    if (!token || saving || !pet || !clinic || !visitReason.trim()) return;
    const start = preferredStart();
    if (!start || slotsLoading || slotsError) { setError('Choose an available preferred time.'); setStep(2); return; }
    if (start.getTime() <= Date.now()) { setError('Choose a future date and time.'); return; }
    setSaving(true); setError('');
    try {
      await ownerCareApi.book({ pet_id: petId, clinic_id: clinicId, start_time: start.toISOString(), reason: type, reason_for_visit: visitReason.trim(), notes: notes.trim() }, token);
      Toast.show({ type: 'success', text1: 'Request sent to your clinic', text2: 'Awaiting clinic confirmation.' });
      navigation.navigate('Main', { screen: 'Appointments' });
    } catch (failure: any) { setError(failure.message || 'Unable to send request.'); if (failure.status === 409) { setStep(2); setSlotsRefresh(value => value + 1); } }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <AppHeader title="Book Appointment" onBack={back} backDisabled={saving} compact />
      <View style={s.bookingPanel}>

      <View style={[s.stepperRow, s.firstStepper]}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <View style={[s.stepItem, s.firstStepItem]}>
              <View style={[s.stepDot, s.firstStepDot, i <= step && { backgroundColor: colors.primary }]}>
                {i < step ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[s.stepNum, i <= step && { color: '#fff' }]}>{i + 1}</Text>}
              </View>
              <Text style={[s.stepLabel, s.firstStepLabel, i === step && { color: colors.primary, fontWeight: '600' }]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[s.stepLine, i < step && { backgroundColor: colors.primary }]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView contentContainerStyle={[s.container, s.firstContainer]} keyboardShouldPersistTaps="handled">
        {!!error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
        {loading && <Text style={s.optSub}>Loading clinic patients...</Text>}
        {!loading && !pets.length && <View style={s.formCard}><Text style={s.optTitle}>No linked clinic patients yet</Text><Text style={s.optSub}>Ask your clinic to register your pet using your account email. Your personal pet profile is separate from the clinic patient record.</Text><TouchableOpacity onPress={load}><Text style={{ color: colors.primary, marginTop: 12 }}>Retry</Text></TouchableOpacity></View>}
        {step === 0 && (
          <View>
            <Text style={[s.petStepTitle, bold]}>Which pet is this for?</Text>
            <Text style={s.petStepSubtitle}>Select a pet to book an appointment.</Text>
            <View style={s.petSearch}><Ionicons name="search-outline" size={18} color={tc.textMuted} /><TextInput accessibilityLabel="Search your pets" placeholder="Search your pets" placeholderTextColor={tc.textMuted} value={petSearch} onChangeText={setPetSearch} style={s.petSearchInput} />{!!petSearch && <TouchableOpacity accessibilityLabel="Clear pet search" onPress={() => setPetSearch('')}><Ionicons name="close-circle" size={17} color={tc.textMuted} /></TouchableOpacity>}</View>
            {filteredPets.map(p => (
              <TouchableOpacity key={p.id} accessibilityRole="radio" accessibilityState={{ checked: petId === p.id }} accessibilityLabel={p.name + ', ' + p.clinic_name} style={[s.petOption, petId === p.id && s.petOptionActive]} onPress={() => { setPetId(p.id); setClinicId(p.clinic_id); }}>
                <View style={s.petPhotoBox}>{p.photo_url ? <Image source={{ uri: p.photo_url }} style={s.petPhoto} /> : <Ionicons name="paw-outline" size={30} color="#005638" />}</View>
                <View style={s.petOptionText}>
                  <Text style={[s.petOptionName, bold, petId === p.id && { color: isDark ? '#B6DDC7' : '#09522C' }]}>{p.name}</Text>
                  <Text style={s.petOptionSpecies}>{[p.species, p.breed].filter(Boolean).join('  \u00b7  ') || 'Pet profile'}</Text>
                  <Text style={s.petOptionClinic}>{p.clinic_name}</Text>
                </View>
                <View style={[s.radio, petId === p.id && s.radioSelected]}>{petId === p.id && <View style={s.radioCenter} />}</View>
              </TouchableOpacity>
            ))}
            {!loading && !!pets.length && !filteredPets.length && <Text style={s.petStepSubtitle}>No pets match your search.</Text>}
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={[s.petStepTitle, bold]}>Choose a clinic</Text>
            <Text style={s.petStepSubtitle}>Select the veterinary clinic where you want to book the appointment.</Text>
            <View style={s.petSearch}><Ionicons name="search-outline" size={18} color={tc.textMuted} /><TextInput accessibilityLabel="Search clinic" placeholder="Search clinic" placeholderTextColor={tc.textMuted} value={clinicSearch} onChangeText={setClinicSearch} style={s.petSearchInput} />{!!clinicSearch && <TouchableOpacity accessibilityLabel="Clear clinic search" onPress={() => setClinicSearch('')}><Ionicons name="close-circle" size={17} color={tc.textMuted} /></TouchableOpacity>}</View>
            {filteredClinics.map(c => (
              <TouchableOpacity key={c.id} accessibilityRole="radio" accessibilityLabel={c.name} accessibilityState={{ checked: clinicId === c.id }} style={[s.clinicOption, clinicId === c.id && s.petOptionActive]} onPress={() => setClinicId(c.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.clinicOptionName, bold, clinicId === c.id && { color: isDark ? '#B6DDC7' : '#09522C' }]}>{c.name}</Text>
                  <Text style={s.clinicAddress}>{c.address || 'Address not provided'}</Text>
                  <View style={s.registeredBadge}><Text style={s.registeredText}>Your Registered Clinic</Text></View>
                </View>
                <View style={[s.radio, clinicId === c.id && s.radioSelected]}>{clinicId === c.id && <View style={s.radioCenter} />}</View>
              </TouchableOpacity>
            ))}
            {!filteredClinics.length && <Text style={s.petStepSubtitle}>{clinicQuery ? 'No clinics match your search.' : 'Choose a pet to see its registered clinic.'}</Text>}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={[s.petStepTitle, bold]}>Appointment details</Text>
            <Text style={s.visitSubtitle}>Provide the visit details so the clinic can prepare for your pet's appointment.</Text>
            <View style={s.visitForm}>
              <Text style={[s.visitLabel, bold]}>Appointment Type <Text style={s.required}>*</Text></Text>
              <MobileSelect label="Appointment type" value={type} options={TYPES} placeholder="Select type..." onChange={setType} style={{ marginBottom: 13 }} />
              <Text style={[s.visitLabel, bold]}>Reason for Visit <Text style={s.required}>*</Text></Text>
              <TextInput accessibilityLabel="Reason for visit, required" style={[s.visitInput, s.visitReason]} value={visitReason} onChangeText={setVisitReason} maxLength={600} placeholder="e.g., annual vaccination, check-up, skin concern, etc." placeholderTextColor={tc.textMuted} multiline />
              <Text style={[s.visitLabel, bold]}>Preferred Date <Text style={s.required}>*</Text></Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose preferred date" style={s.visitPicker} onPress={() => setDateModal(true)}><Ionicons name="calendar-outline" size={17} color="#46725B" /><Text style={[s.visitInputText, { flex: 1, marginLeft: 12 }, !date && { color: tc.textMuted }]}>{date || 'Select date...'}</Text><Ionicons name="chevron-down" size={16} color={tc.textSecondary} /></TouchableOpacity>
              <Text style={[s.visitLabel, bold]}>Preferred Time <Text style={s.required}>*</Text></Text>
              {!date && <Text style={s.availabilityHelp}>Choose a date to see available doctor times.</Text>}
              {slotsLoading && <Text style={s.availabilityHelp}>Checking doctor availability...</Text>}
              {!!slotsError && <TouchableOpacity onPress={() => setSlotsRefresh(value => value + 1)}><Text style={s.availabilityError}>{slotsError} Tap to retry.</Text></TouchableOpacity>}
              {!!date && !slotsLoading && !slotsError && !availableSlots.length && <Text style={s.availabilityHelp}>No available doctor times for this date. Please choose another date.</Text>}
              <View style={s.timeGrid}>{availableSlots.map(slot => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: time === slot.label }} key={slot.start_time} style={[s.timeChip, time === slot.label && s.timeChipActive]} onPress={() => setTime(slot.label)}><Text style={[s.timeText, time === slot.label && { color: '#FFFFFF' }]}>{slot.label}</Text></TouchableOpacity>)}</View>
              {!!availableSlots.length && <Text style={s.availabilityHelp}>Clinic time (Asia/Manila). Availability is checked again when you submit.</Text>}
              <Text style={[s.visitLabel, bold]}>Additional Notes (Optional)</Text>
              <TextInput accessibilityLabel="Additional notes, optional" style={[s.visitInput, s.visitNotes]} value={notes} onChangeText={setNotes} maxLength={1200} placeholder="Any special concerns or information for the veterinarian..." placeholderTextColor={tc.textMuted} multiline />
            </View>
            <View style={s.reminder}><Ionicons name="information-circle-outline" size={23} color="#00633D" /><View style={{ flex: 1 }}><Text style={[s.reminderTitle, bold]}>Important Reminder</Text><Text style={s.reminderBody}>For urgent or emergency cases, please contact the clinic directly or visit the nearest veterinary clinic.</Text></View></View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={[s.reviewTitle, bold]}>Review &amp; Request Appointment</Text>
            <Text style={s.reviewSubtitle}>Please review your appointment details before submitting your request.</Text>
            <View style={s.reviewCard}>
              <View style={s.reviewPet}>
                <View style={s.reviewPhotoBox}>{pet?.photo_url ? <Image source={{ uri: pet.photo_url }} style={s.reviewPhoto} /> : <Ionicons name="paw-outline" size={30} color="#005638" />}</View>
                <View style={s.reviewPetText}><Text style={[s.reviewPetName, bold]}>{pet?.name}</Text><Text style={s.reviewPetSpecies}>{[pet?.species, pet?.breed].filter(Boolean).join(' \u00b7 ') || 'Pet profile'}</Text></View>
              </View>
              {[
                { icon: 'location-outline', label: 'Clinic', value: clinic?.name, strong: true },
                { icon: 'calendar-outline', label: 'Appointment Type', value: type },
                { icon: 'medical-outline', label: 'Reason for Visit', value: visitReason.trim() },
                { icon: 'calendar-outline', label: 'Preferred Date', value: date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' },
                { icon: 'time-outline', label: 'Preferred Time', value: time },
                { icon: 'document-text-outline', label: 'Additional Notes', value: notes.trim() || 'None' },
              ].map(row => <View key={row.label} style={s.reviewRow}><Ionicons name={row.icon as keyof typeof Ionicons.glyphMap} size={19} color={isDark ? '#B6DDC7' : '#00633D'} /><Text style={s.reviewLabel}>{row.label}</Text><Text style={[s.reviewValue, row.strong && bold]}>{row.value}</Text></View>)}
            </View>
            <View style={s.requestReminder}><Ionicons name="information-circle-outline" size={23} color="#00633D" /><View style={{ flex: 1 }}><Text style={[s.reminderTitle, bold]}>This is an appointment request.</Text><Text style={s.reminderBody}>Your doctor will review your request and notify you once the schedule is confirmed.</Text></View></View>
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, s.firstFooter, step >= 1 && s.clinicFooter]}>
        {step >= 1 && <TouchableOpacity accessibilityRole="button" style={[s.clinicBack, step === 3 && { minHeight: 52 }, saving && { opacity: 0.5 }]} disabled={saving} onPress={back}><Text style={[s.clinicBackText, step === 3 && { fontSize: 16 }]}>Back</Text></TouchableOpacity>}
        {step < 3
          ? <TouchableOpacity style={[s.nextBtn, s.firstNext, step >= 1 && { flex: 1 }, !canNext() && { opacity: 0.5 }]} onPress={next} disabled={!canNext()}>
              <Text style={[s.nextBtnText, bold, { fontSize: 16 }]}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          : <TouchableOpacity accessibilityRole="button" accessibilityLabel="Request appointment" style={[s.nextBtn, s.firstNext, { flex: 1, gap: 6, minHeight: 52 }, saving && { opacity: 0.5 }]} onPress={confirm} disabled={saving}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={[s.nextBtnText, bold, { fontSize: 15 }]}>{saving ? 'Sending...' : 'Request Appointment'}</Text>
            </TouchableOpacity>
        }
      </View>

      </View>


      <Modal visible={dateModal} transparent animationType="fade" onRequestClose={() => setDateModal(false)}>
        <View style={s.dateOverlay}><View style={s.dateDialog}>
          <View style={s.calendarHeader}><TouchableOpacity accessibilityLabel="Previous month" onPress={() => setCalendarMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={24} color={tc.text} /></TouchableOpacity><Text style={[s.calendarTitle, bold]}>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><TouchableOpacity accessibilityLabel="Next month" onPress={() => setCalendarMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={24} color={tc.text} /></TouchableOpacity></View>
          <View style={s.calendarGrid}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <View key={'weekday-' + index} style={s.calendarCell}><Text style={s.calendarWeekday}>{day}</Text></View>)}
            {calendarDays.map((day, index) => { const value = day ? localDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)) : ''; const disabled = !day || value < today; return <TouchableOpacity key={index} disabled={disabled} accessibilityRole="button" accessibilityLabel={value || 'Empty day'} accessibilityState={{ selected: value === date, disabled }} style={[s.calendarCell, value === date && s.calendarSelected]} onPress={() => { setDate(value); setDateModal(false); }}><Text style={[s.calendarDay, disabled && { opacity: 0.3 }, value === date && { color: '#FFFFFF' }]}>{day || ''}</Text></TouchableOpacity>; })}
          </View><TouchableOpacity style={s.modalCancel} onPress={() => setDateModal(false)}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#005638' },
  bookingPanel: { flex: 1, backgroundColor: tc.background, borderTopLeftRadius: 21, borderTopRightRadius: 21, overflow: 'hidden' },
  firstStepper: { paddingHorizontal: 15, paddingTop: 16, paddingBottom: 23 },
  firstStepItem: { width: 57 },
  firstStepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#C8DED0' },
  firstStepLabel: { fontSize: 11, lineHeight: 16, maxWidth: 70, color: tc.text },
  firstContainer: { paddingHorizontal: 15, paddingTop: 0, paddingBottom: 20 },
  petStepTitle: { fontSize: 20, lineHeight: 27, color: tc.text, marginBottom: 3 },
  petStepSubtitle: { fontSize: 14, lineHeight: 20, color: tc.textSecondary, marginBottom: 12 },
  petSearch: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: tc.border, borderRadius: 11, backgroundColor: isDark ? tc.surface : '#FAFAFA', marginBottom: 17 },
  petSearchInput: { flex: 1, fontSize: 14, color: tc.text, paddingVertical: 8 },
  petOption: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 85, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: tc.border, borderRadius: 13, backgroundColor: tc.surface, marginBottom: 8 },
  petOptionActive: { borderColor: '#33845B', backgroundColor: isDark ? '#173E2B' : '#ECF8EF' },
  petPhotoBox: { width: 63, height: 63, borderRadius: 10, backgroundColor: '#DCEEE2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  petPhoto: { width: 63, height: 55 },
  petOptionText: { flex: 1 },
  petOptionName: { color: tc.text, fontSize: 17, lineHeight: 19 },
  petOptionSpecies: { color: tc.text, fontSize: 13, lineHeight: 18, marginTop: 1 },
  petOptionClinic: { color: tc.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 1 },
  radio: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#8B918D', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#007241' },
  radioCenter: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#007241' },
  reviewTitle: { color: tc.text, fontSize: 21, lineHeight: 28, marginBottom: 4 },
  reviewSubtitle: { color: tc.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  reviewCard: { borderWidth: 1, borderColor: tc.border, borderRadius: 13, backgroundColor: tc.surface, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 7 },
  reviewPet: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 12 },
  reviewPhotoBox: { width: 65, height: 65, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F1E5' },
  reviewPhoto: { width: 65, height: 57 },
  reviewPetText: { flex: 1, borderLeftWidth: 1, borderLeftColor: tc.border, paddingLeft: 12, marginLeft: 12, paddingVertical: 6 },
  reviewPetName: { color: tc.text, fontSize: 17, lineHeight: 21 },
  reviewPetSpecies: { color: tc.text, fontSize: 14, lineHeight: 20, marginTop: 2 },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: tc.border, paddingVertical: 10 },
  reviewLabel: { width: '35%', color: tc.text, fontSize: 14, lineHeight: 18 },
  reviewValue: { flex: 1, color: tc.text, fontSize: 14, lineHeight: 18 },
  requestReminder: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 13, backgroundColor: '#EFF7F2', padding: 15, marginTop: 18, marginBottom: 10 },
  visitSubtitle: { color: tc.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 9 },
  visitForm: { borderWidth: 1, borderColor: tc.border, borderRadius: 15, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 15, backgroundColor: tc.surface },
  visitLabel: { color: tc.text, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  required: { color: '#C32626' },
  visitPicker: { minHeight: 42, borderWidth: 1, borderColor: isDark ? tc.border : '#BCD5C6', borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, marginBottom: 13, backgroundColor: isDark ? tc.inputBg : '#FAFBFA' },
  visitInputText: { color: tc.text, fontSize: 14, lineHeight: 17 },
  visitInput: { borderWidth: 1, borderColor: isDark ? tc.border : '#BCD5C6', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 10, fontSize: 14, lineHeight: 20, color: tc.text, backgroundColor: isDark ? tc.inputBg : '#FAFBFA', textAlignVertical: 'top' },
  visitReason: { minHeight: 64, marginBottom: 10 },
  visitNotes: { minHeight: 54 },
  availabilityHelp: { color: tc.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 9 },
  availabilityError: { color: '#B42318', fontSize: 12, lineHeight: 17, marginBottom: 9 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  timeChip: { width: '23%', minHeight: 38, borderWidth: 1, borderColor: '#BCD5C6', borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? tc.inputBg : '#FAFBFA' },
  timeChipActive: { backgroundColor: '#285C43', borderColor: '#285C43' },
  timeText: { color: isDark ? '#B6DDC7' : '#1D5738', fontSize: 13, lineHeight: 16 },
  reminder: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 13, marginTop: 12, backgroundColor: isDark ? '#DDEDE3' : '#EFF7F2' },
  reminderTitle: { color: '#005638', fontSize: 14, lineHeight: 17 },
  reminderBody: { color: '#3F4B45', fontSize: 13, lineHeight: 15 },
  dateOverlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 22 },
  dateDialog: { padding: 16, borderRadius: 18, backgroundColor: tc.surface, maxWidth: 420, width: '100%', alignSelf: 'center' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  calendarTitle: { color: tc.text, fontSize: 17 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  calendarSelected: { backgroundColor: '#005638' },
  calendarWeekday: { color: tc.textMuted, fontSize: 12 },
  calendarDay: { color: tc.text, fontSize: 14 },
  clinicOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 17, paddingVertical: 13, minHeight: 67, borderWidth: 1, borderColor: tc.border, borderRadius: 13, backgroundColor: tc.surface, marginBottom: 8 },
  clinicOptionName: { color: tc.text, fontSize: 16, lineHeight: 21 },
  clinicAddress: { color: tc.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
  registeredBadge: { alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: '#C8EECE' },
  registeredText: { color: '#16512A', fontSize: 10, lineHeight: 14 },
  clinicFooter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  clinicBack: { width: '34%', minHeight: 48, borderWidth: 1, borderColor: '#33845B', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clinicBackText: { color: isDark ? '#B6DDC7' : '#005638', fontSize: 14 },
  firstFooter: { borderTopWidth: 0, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 28 },
  firstNext: { minHeight: 48, paddingVertical: 10, borderRadius: 14, backgroundColor: '#005638', gap: 14 },
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
