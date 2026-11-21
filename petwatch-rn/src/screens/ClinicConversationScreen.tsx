import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Modal, ScrollView, Linking, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { format, isToday, isYesterday, isValid } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ownerInboxApi, OwnerConversation, ownerCareApi, ownerSharedRecordsApi, clinicsApi } from '../services/api';
import { escapeReportHtml as htmlText } from '../utils/medicalActivity';

const GREEN = '#005638';
type SharedRecord = { shareId: string; recordId: string; title: string; type?: string; category?: string; detail?: string; date?: string };
type ChatMessage = { key: string; text: string; time: string; source: string; author?: string; records: SharedRecord[] };
const validDate = (value: string) => { const date = new Date(value); return isValid(date) ? date : null; };
const dayLabel = (value: string) => { const date = validDate(value); return !date ? '' : isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMM d, yyyy'); };
const timeLabel = (value: string) => { const date = validDate(value); return date ? format(date, 'h:mm a') : ''; };

export default function ClinicConversationScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const id = route.params.threadId;
  const [thread, setThread] = useState<OwnerConversation | null>(route.params.thread || null);
  const [pet, setPet] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [shares, setShares] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(41);
  const [attachment, setAttachment] = useState<SharedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [recordSheet, setRecordSheet] = useState<'view' | 'attach' | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SharedRecord | null>(null);
  const [exporting, setExporting] = useState(false);
  const list = useRef<FlatList>(null);
  const atBottom = useRef(true);
  const revision = useRef(0);
  const sendingRef = useRef(false);
  const exportingRef = useRef(false);
  const tokenRef = useRef(token); tokenRef.current = token;
  const s = styles(tc, isDark, insets.bottom);
  const petId = thread?.petId || Number(id.replace('pet-', ''));
  const load = useCallback(async () => {
    if (!token || sendingRef.current) return;
    const version = ++revision.current;
    try {
      const [conversationResult, recordsResult] = await Promise.allSettled([ownerInboxApi.list(token), ownerSharedRecordsApi.list(token)]);
      if (version !== revision.current || tokenRef.current !== token) return;
      if (conversationResult.status === 'rejected') throw conversationResult.reason;
      let next = conversationResult.value.find(row => row.id === id);
      if (!next) throw new Error('Conversation not found.');
      if (next.unread) next = await ownerInboxApi.read(token, id);
      if (version === revision.current && tokenRef.current === token) {
        setThread(next);
        if (recordsResult.status === 'fulfilled') setShares(recordsResult.value.filter((bundle: any) => String(bundle.petId) === String(next!.petId)));
        setError(recordsResult.status === 'rejected' ? 'Shared records could not be loaded. Pull down to retry.' : '');
      }
    } catch (failure: any) { if (version === revision.current && tokenRef.current === token) setError(failure.message || 'Unable to load conversation.'); }
    finally { if (version === revision.current) setLoading(false); }
  }, [token, id]);
  useFocusEffect(useCallback(() => {
    void load(); const timer = setInterval(() => void load(), 5000);
    StatusBar.setBarStyle('light-content');
    return () => { revision.current++; clearInterval(timer); StatusBar.setBarStyle('default'); };
  }, [load]));
  useFocusEffect(useCallback(() => {
    let active = true;
    const details = async () => {
      if (!token) return;
      try {
        const care = await ownerCareApi.overview(token);
        const patient = care.clinicPets.find((item: any) => String(item.id) === String(petId));
        if (!active || tokenRef.current !== token) return;
        setPet(patient ? { ...patient, source: 'clinic' } : null);
        if (patient?.clinic_id) { const clinic = await clinicsApi.getById(String(patient.clinic_id), token); if (active && tokenRef.current === token) setPhone(clinic.phone || ''); }
      } catch { /* Messages remain accessible if profile or contact details are unavailable. */ }
    };
    void details(); return () => { active = false; };
  }, [token, petId]));

  const records: SharedRecord[] = shares.flatMap(bundle => (bundle.records || []).map((record: any) => ({ ...record, shareId: String(bundle.id), recordId: String(record.id), title: record.title || 'Patient record' })));
  const messages: ChatMessage[] = [
    ...(thread?.messages || []).map((message, index) => ({ ...message, key: `message:${message.time}:${index}`, records: message.sharedRecord ? [message.sharedRecord] : [] })),
    ...shares.map(bundle => ({ key: `share:${bundle.id}`, text: bundle.message?.trim() || `Records shared for ${bundle.petName || thread?.petName || 'your pet'}.`, time: bundle.createdAt, source: 'Clinic', author: thread?.clinicName, records: (bundle.records || []).map((record: any) => ({ ...record, shareId: String(bundle.id), recordId: String(record.id), title: record.title || 'Patient record' })) })),
  ].sort((a, b) => (Date.parse(a.time) || 0) - (Date.parse(b.time) || 0));
  const patient = pet || (thread ? { id: thread.petId, name: thread.petName, source: 'clinic' } : null);
  const birthday = pet?.birth_date ? validDate(pet.birth_date) : null;
  const years = birthday ? Math.max(0, Math.floor((Date.now() - birthday.getTime()) / 31557600000)) : null;
  const age = years === null ? '' : years < 1 ? 'Under 1 year old' : `${years} ${years === 1 ? 'year' : 'years'} old`;
  const petDescription = [pet?.species, pet?.sex && pet.sex !== 'unknown' ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '', age].filter(Boolean).join(' • ');
  const photo = pet?.photo_url || pet?.photoUrl;
  const viewPet = () => { if (patient) navigation.navigate('PetProfile', { pet: patient }); };
  const book = () => { if (patient && pet?.clinic_id) navigation.navigate('BookAppointment', { clinicPetId: String(patient.id), clinicId: String(pet.clinic_id) }); };
  const call = async () => { if (!phone) return; setMenu(false); try { await Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`); } catch { setError('Unable to open the phone app on this device.'); } };
  const send = async () => {
    if (!token || (!draft.trim() && !attachment) || sendingRef.current) return;
    revision.current++; sendingRef.current = true; setSending(true); setError(''); atBottom.current = true;
    try {
      const next = await ownerInboxApi.send(token, id, draft.trim(), attachment ? { shareId: attachment.shareId, recordId: attachment.recordId } : undefined);
      if (tokenRef.current === token) { setThread(next); setDraft(''); setAttachment(null); }
    } catch (failure: any) { if (tokenRef.current === token) setError(failure.message || 'Message could not be sent. Try again.'); }
    finally { sendingRef.current = false; setSending(false); setLoading(false); }
  };
  const download = async (record: SharedRecord) => {
    if (exportingRef.current) return;
    exportingRef.current = true; setExporting(true); setError('');
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#172d21;line-height:1.6;padding:28px}h1{color:#005638;font-size:24px}p{white-space:pre-wrap}small{color:#52655a}</style></head><body><h1>${htmlText(record.title)}</h1><p>${htmlText(thread?.clinicName)}<br>Patient: ${htmlText(thread?.petName)}</p>${record.date ? `<small>${htmlText(dayLabel(record.date))}</small>` : ''}<p>${htmlText(record.detail || 'No additional details recorded.')}</p><small>Shared medical record provided by your veterinary clinic.</small></body></html>`;
      if (Platform.OS === 'web') {
        const preview = window.open('', '_blank', 'width=800,height=700');
        if (!preview) throw new Error('Allow pop-ups to download this record as a PDF.');
        preview.opener = null;
        preview.document.open(); preview.document.write(html); preview.document.close();
        preview.focus(); preview.print();
      }
      else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Saving or sharing PDF files is unavailable on this device.');
        const file = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Save ${record.title}` });
      }
    } catch (failure: any) { setError(failure.message || 'Unable to download this record.'); }
    finally { exportingRef.current = false; setExporting(false); }
  };
  const recordCard = (record: SharedRecord, index: number) => <TouchableOpacity key={`${record.shareId}:${record.recordId}:${index}`} accessibilityLabel={`View shared record: ${record.title}`} style={s.attachmentCard} onPress={() => setSelectedRecord(record)}><View style={s.fileIcon}><Ionicons name="document-text-outline" size={22} color={GREEN} /></View><View style={s.fileInfo}><Text numberOfLines={1} style={s.fileTitle}>{record.title}</Text><Text style={s.fileMeta}>PDF</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Download ${record.title}`} disabled={exporting} onPress={event => { event.stopPropagation(); void download(record); }} style={s.download}>{exporting ? <ActivityIndicator size="small" color={GREEN} /> : <Ionicons name="download-outline" size={21} color={GREEN} />}</TouchableOpacity></TouchableOpacity>;

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <View style={s.header}><LinearGradient colors={['#00623D', '#00492E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={s.wave}><Svg width="100%" height="100%" viewBox="0 0 468 20" preserveAspectRatio="none"><Path d="M0 3 C150 30 250 -8 468 5 L468 24 L0 24Z" fill="#087B50" /></Svg></View><TouchableOpacity accessibilityLabel="Back to inbox" onPress={() => navigation.goBack()} style={s.back}><Ionicons name="arrow-back" size={23} color="#FFFFFF" /></TouchableOpacity><View style={s.headerAvatar}><Ionicons name="storefront-outline" size={23} color={GREEN} /></View><View style={s.headerInfo}><Text numberOfLines={1} style={s.headerTitle}>{thread?.clinicName || 'Your veterinary clinic'}</Text><Text style={s.headerSubtitle}>Conversation with your clinic</Text></View><TouchableOpacity accessibilityLabel="Conversation options" onPress={() => setMenu(true)} style={s.menuButton}><Ionicons name="ellipsis-vertical" size={23} color="#FFFFFF" /></TouchableOpacity></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.panel}>
      <View style={s.petCard}>{photo ? <Image source={{ uri: photo }} style={s.petPhoto} /> : <View style={s.petPhoto}><Ionicons name="paw-outline" size={27} color={GREEN} /></View>}<View style={s.petInfo}><Text style={s.petName}>{patient?.name || 'Your pet'}</Text>{!!petDescription && <Text numberOfLines={2} style={s.petDescription}>{petDescription}</Text>}</View><TouchableOpacity accessibilityLabel="View pet record" disabled={!patient} onPress={viewPet} style={s.petRecord}><Text style={s.petRecordText}>View Pet Record</Text></TouchableOpacity></View>
      {!!error && <TouchableOpacity accessibilityLabel="Retry loading conversation" onPress={() => void load()}><Text style={s.error}>{error}</Text></TouchableOpacity>}
      <FlatList ref={list} data={messages} keyExtractor={item => item.key} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled" onScroll={event => { const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent; atBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 70; }} scrollEventThrottle={100} onContentSizeChange={() => { if (atBottom.current) list.current?.scrollToEnd({ animated: false }); }} refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} renderItem={({ item, index }) => {
        const own = item.source === 'Owner';
        const newDay = index === 0 || dayLabel(item.time) !== dayLabel(messages[index - 1].time);
        const showClinicName = !own && !messages.slice(0, index).some(message => message.source !== 'Owner' && dayLabel(message.time) === dayLabel(item.time));
        return <View>{newDay && !!dayLabel(item.time) && <View style={s.dayRow}><Text style={s.day}>{dayLabel(item.time)}</Text></View>}<View style={[s.messageRow, own && s.ownRow]}>{!own && <View style={s.clinicAvatar}><Ionicons name="storefront-outline" size={22} color={GREEN} /></View>}<View style={[s.messageContent, own && s.ownContent]}><View style={[s.bubble, { maxWidth: Math.min(width * (own ? 0.73 : 0.60), 430) }, own && s.ownBubble]}>{showClinicName && <Text style={s.author}>{thread?.clinicName}</Text>}<Text style={[s.body, own && s.ownBody]}>{item.text}</Text>{item.records.map(recordCard)}</View><View style={[s.timeRow, own && s.ownTime]}><Text style={s.time}>{timeLabel(item.time)}</Text>{own && <Ionicons name="checkmark-done-outline" size={15} color={GREEN} accessibilityLabel="Sent" />}</View></View></View></View>;
      }} ListEmptyComponent={<View style={s.empty}>{loading && <ActivityIndicator color={GREEN} />}<Text style={s.emptyText}>{loading ? 'Loading conversation...' : 'Send your first message to the clinic.'}</Text></View>} />
      <View style={s.quickActions}><TouchableOpacity accessibilityLabel="Book appointment" disabled={!pet?.clinic_id} onPress={book} style={[s.quickButton, !pet?.clinic_id && s.disabled]}><Ionicons name="calendar-outline" size={18} color={GREEN} /><Text numberOfLines={1} style={s.quickText}>Book Appointment</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="View shared records" onPress={() => setRecordSheet('view')} style={s.quickButton}><Ionicons name="document-text-outline" size={18} color={GREEN} /><Text numberOfLines={1} style={s.quickText}>View Shared Records</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Call clinic" disabled={!phone} onPress={() => void call()} style={[s.quickButton, s.callButton, !phone && s.disabled]}><Ionicons name="call" size={17} color={GREEN} /><Text style={s.quickText}>Call Clinic</Text></TouchableOpacity></View>
      {!!attachment && <View style={s.pendingAttachment}><Ionicons name="document-text-outline" size={19} color={GREEN} /><Text numberOfLines={1} style={s.pendingTitle}>{attachment.title}</Text><TouchableOpacity accessibilityLabel="Remove attached record" disabled={sending} onPress={() => setAttachment(null)}><Ionicons name="close-circle-outline" size={21} color={GREEN} /></TouchableOpacity></View>}
      <View style={s.composer}><View style={s.inputBox}><TextInput accessibilityLabel="Message to clinic" value={draft} onChangeText={setDraft} onContentSizeChange={event => setInputHeight(Math.max(41, Math.min(120, event.nativeEvent.contentSize.height)))} placeholder="Type a message..." placeholderTextColor={tc.textMuted} multiline maxLength={4000} editable={!sending} style={[s.input, { height: inputHeight }]} /><TouchableOpacity accessibilityLabel="Attach shared record" disabled={sending} onPress={() => setRecordSheet('attach')} style={s.paperclip}><Ionicons name="attach-outline" size={25} color={GREEN} /></TouchableOpacity></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message" disabled={sending || (!draft.trim() && !attachment)} onPress={() => void send()} style={[s.send, sending && s.disabled]}>{sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={23} color="#FFFFFF" />}</TouchableOpacity></View>
    </KeyboardAvoidingView>
    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}><TouchableOpacity activeOpacity={1} style={s.menuBackdrop} onPress={() => setMenu(false)}><View style={[s.menuSheet, { marginTop: insets.top + 50 }]}><TouchableOpacity style={s.menuItem} onPress={() => { setMenu(false); void load(); }}><Ionicons name="refresh-outline" size={20} color={GREEN} /><Text style={s.menuText}>Refresh conversation</Text></TouchableOpacity><TouchableOpacity style={s.menuItem} onPress={() => { setMenu(false); setRecordSheet('view'); }}><Ionicons name="document-text-outline" size={20} color={GREEN} /><Text style={s.menuText}>Shared records</Text></TouchableOpacity><TouchableOpacity disabled={!phone} style={[s.menuItem, !phone && s.disabled]} onPress={() => void call()}><Ionicons name="call-outline" size={20} color={GREEN} /><Text style={s.menuText}>{phone ? 'Call clinic' : 'No clinic phone listed'}</Text></TouchableOpacity></View></TouchableOpacity></Modal>
    <Modal visible={!!recordSheet || !!selectedRecord} transparent animationType="slide" onRequestClose={() => { setRecordSheet(null); setSelectedRecord(null); }}><View style={s.backdrop}><View style={s.sheet}><View style={s.sheetHeading}><Text style={s.sheetTitle}>{selectedRecord ? selectedRecord.title : recordSheet === 'attach' ? 'Attach a shared record' : 'Shared records'}</Text><TouchableOpacity accessibilityLabel="Close shared records" onPress={() => { setRecordSheet(null); setSelectedRecord(null); }}><Ionicons name="close" size={25} color={tc.text} /></TouchableOpacity></View>{selectedRecord ? <ScrollView contentContainerStyle={s.sheetContent}><Text style={s.recordClinic}>{thread?.clinicName} · {thread?.petName}</Text>{!!selectedRecord.date && <Text style={s.recordMeta}>{dayLabel(selectedRecord.date)}</Text>}<Text style={s.recordDetail}>{selectedRecord.detail || 'No additional details recorded.'}</Text><TouchableOpacity disabled={exporting} style={s.exportButton} onPress={() => void download(selectedRecord)}><Ionicons name="download-outline" size={21} color="#FFFFFF" /><Text style={s.exportText}>{exporting ? 'Preparing PDF...' : 'Download PDF'}</Text></TouchableOpacity></ScrollView> : <FlatList data={records} keyExtractor={(record, index) => `${record.shareId}:${record.recordId}:${index}`} contentContainerStyle={s.sheetContent} renderItem={({ item }) => <TouchableOpacity style={s.recordRow} accessibilityLabel={`${recordSheet === 'attach' ? 'Attach' : 'View'} ${item.title}`} onPress={() => { if (recordSheet === 'attach') { setAttachment(item); setRecordSheet(null); } else setSelectedRecord(item); }}><Ionicons name="document-text-outline" size={23} color={GREEN} /><View style={s.recordInfo}><Text style={s.recordTitle}>{item.title}</Text><Text style={s.recordMeta}>{item.category || 'Shared medical record'}</Text></View><Ionicons name={recordSheet === 'attach' ? 'add-circle-outline' : 'chevron-forward'} size={22} color={GREEN} /></TouchableOpacity>} ListEmptyComponent={<Text style={s.emptyText}>No records have been shared for this pet yet.</Text>} />}</View></View></Modal>
  </SafeAreaView>;
}

const styles = (tc: any, dark: boolean, bottom: number) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN }, header: { height: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8, gap: 9, overflow: 'hidden' }, wave: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 19 }, back: { width: 28, paddingTop: 8 }, headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6F3EB', alignItems: 'center', justifyContent: 'center' }, headerInfo: { flex: 1, paddingTop: 2, minWidth: 0 }, headerTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '700' }, headerSubtitle: { color: '#E4F4EB', fontSize: 12, lineHeight: 17 }, menuButton: { paddingTop: 8, paddingLeft: 6 }, panel: { flex: 1, backgroundColor: dark ? tc.background : '#FFFFFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden' }, petCard: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 66, marginHorizontal: 14, marginTop: 14, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: dark ? tc.border : '#EBEBEF', backgroundColor: tc.surface, shadowColor: '#000000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 2, elevation: 1 }, petPhoto: { width: 48, height: 48, borderRadius: 22, backgroundColor: '#EAF4EE', justifyContent: 'center', alignItems: 'center' }, petInfo: { flex: 1, minWidth: 0 }, petName: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: tc.text }, petDescription: { fontSize: 11, lineHeight: 16, color: tc.textSecondary }, petRecord: { borderWidth: 1, borderColor: '#247F44', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 13 }, petRecordText: { fontSize: 11, fontWeight: '700', color: dark ? '#A9D6B7' : '#006128' },
  messages: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, flexGrow: 1 }, dayRow: { alignItems: 'center', marginBottom: 10 }, day: { backgroundColor: dark ? tc.surface : '#E7F2EB', color: dark ? tc.text : '#285641', paddingHorizontal: 18, paddingVertical: 4, borderRadius: 15, fontSize: 11 }, messageRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' }, ownRow: { justifyContent: 'flex-end', marginTop: 0 }, clinicAvatar: { width: 34, height: 34, backgroundColor: '#E7F3EB', borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 1 }, messageContent: { flex: 1, alignItems: 'flex-start' }, ownContent: { alignItems: 'flex-end' }, bubble: { backgroundColor: dark ? tc.surface : '#F1F1F5', padding: 13, borderRadius: 15 }, ownBubble: { backgroundColor: GREEN, borderBottomRightRadius: 14 }, author: { color: tc.text, fontSize: 12, lineHeight: 16, fontWeight: '700', marginBottom: 5 }, body: { color: tc.text, fontSize: 13, lineHeight: 17 }, ownBody: { color: '#FFFFFF' }, timeRow: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 4, paddingHorizontal: 3 }, ownTime: { justifyContent: 'flex-end' }, time: { color: tc.textMuted, fontSize: 10 }, attachmentCard: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: dark ? tc.border : '#E0E3E4', backgroundColor: dark ? '#DDEDE3' : '#FAFBFB', marginTop: 8, paddingHorizontal: 7, paddingVertical: 6 }, fileIcon: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#E7F3EB', alignItems: 'center', justifyContent: 'center' }, fileInfo: { flex: 1, minWidth: 85 }, fileTitle: { fontSize: 11, fontWeight: '700', color: '#13261B' }, fileMeta: { fontSize: 10, color: '#58675E', marginTop: 2 }, download: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F2EA' },
  quickActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: dark ? tc.border : '#F0F1F2', backgroundColor: tc.surface }, quickButton: { flex: 1.25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: dark ? tc.border : '#D6DFDA', borderRadius: 8, paddingHorizontal: 6, minHeight: 31 }, callButton: { flex: 0.9 }, quickText: { fontSize: 9.5, fontWeight: '700', color: dark ? '#A9D6B7' : GREEN, flexShrink: 1 }, disabled: { opacity: 0.45 }, pendingAttachment: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: dark ? tc.surface : '#EDF5EF', paddingVertical: 9, paddingHorizontal: 20 }, pendingTitle: { flex: 1, fontSize: 12, color: tc.text }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 11, paddingHorizontal: 16, paddingTop: 11, paddingBottom: Math.max(bottom, 21), backgroundColor: tc.surface }, inputBox: { flex: 1, minHeight: 43, maxHeight: 140, borderRadius: 23, flexDirection: 'row', alignItems: 'center', backgroundColor: dark ? tc.background : '#F8F8FA', borderWidth: 1, borderColor: dark ? tc.border : '#DBDCE4', paddingLeft: 15 }, input: { flex: 1, paddingVertical: 11, color: tc.text, fontSize: 13, minWidth: 0, maxHeight: 130 }, paperclip: { paddingHorizontal: 11, paddingVertical: 8 }, send: { width: 43, height: 43, borderRadius: 22, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' }, error: { color: dark ? '#FFB4B4' : '#B42318', paddingHorizontal: 17, paddingBottom: 10, fontSize: 12, lineHeight: 18 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, emptyText: { color: tc.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 15 },
  menuBackdrop: { flex: 1, backgroundColor: '#00000033', alignItems: 'flex-end', paddingRight: 13 }, menuSheet: { borderRadius: 13, paddingVertical: 5, backgroundColor: tc.surface, minWidth: 230 }, menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 }, menuText: { color: tc.text, fontSize: 13 }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }, sheet: { maxHeight: '80%', backgroundColor: tc.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: Math.max(bottom, 22) }, sheetHeading: { paddingHorizontal: 22, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 15 }, sheetTitle: { flex: 1, color: tc.text, fontSize: 19, fontWeight: '700' }, sheetContent: { paddingHorizontal: 22, paddingBottom: 15 }, recordRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: tc.border }, recordInfo: { flex: 1 }, recordTitle: { color: tc.text, fontSize: 14, fontWeight: '600' }, recordMeta: { color: tc.textSecondary, fontSize: 12, lineHeight: 18 }, recordClinic: { color: tc.text, fontSize: 14, fontWeight: '600', marginBottom: 6 }, recordDetail: { color: tc.text, fontSize: 14, lineHeight: 22, marginVertical: 18 }, exportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 13, borderRadius: 10, backgroundColor: GREEN }, exportText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
