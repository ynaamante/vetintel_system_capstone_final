import HeaderSurface, { roundedScreenPanel } from '../components/HeaderSurface';
import NotificationButton from '../components/NotificationButton';
import Toast from 'react-native-toast-message';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ArchiveDialog from '../components/ArchiveDialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, isToday, isYesterday, isValid } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOwnerNotifications } from '../context/OwnerNotificationsContext';
import { ownerSharedRecordsApi, ownerCareApi, ownerInboxApi, OwnerConversation } from '../services/api';
import { colors, gradients } from '../theme/colors';

const GREEN = colors.primary;
type Tab = 'all' | 'unread' | 'updates';
type InboxItem = { key: string; clinicName: string; message: string; date: string; records: any[]; read: boolean; threadId?: string; notificationId?: string; notificationType?: string; petName?: string; petId?: number };
const initials = (name: string) => {
  const words = name.split(/\s+/).filter(word => /[a-z0-9]/i.test(word) && !/^(and|veterinary|clinic|animal|hospital)$/i.test(word));
  const capitals = (words[0] || '').match(/[A-Z]/g);
  return capitals && capitals.length > 1 ? capitals.slice(0, 2).join('') : words.slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'VC';
};
const timestamp = (value: string) => {
  const date = new Date(value);
  return !isValid(date) ? '' : isToday(date) ? format(date, 'h:mm a') : isYesterday(date) ? 'Yesterday' : format(date, 'MMM d');
};
const chip = (record: any): { label: string; icon: keyof typeof Ionicons.glyphMap } => {
  const type = `${record.type || ''} ${record.category || ''}`.toLowerCase();
  if (/lab|test|result/.test(type)) return { label: 'Lab Result', icon: 'document-text-outline' };
  if (/vacci|vaccine/.test(type)) return { label: 'Vaccination', icon: 'medkit-outline' };
  if (/appointment/.test(type)) return { label: 'Appointment', icon: 'calendar-outline' };
  if (/visit|consultation/.test(type)) return { label: 'Visit Summary', icon: 'document-text-outline' };
  return { label: 'Patient Record', icon: 'document-text-outline' };
};

export default function MessagesScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const { notifications, refresh: refreshNotifications, markRead } = useOwnerNotifications();
  const [bundles, setBundles] = useState<any[]>([]);
  const [threads, setThreads] = useState<OwnerConversation[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const readIdsRef = useRef<string[]>([]);
  const readReady = useRef(false);
  const storageWrites = useRef(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<InboxItem | null>(null);
  const [archiving, setArchiving] = useState(false);
  const archiveBusy = useRef(false);
  const [archiveError, setArchiveError] = useState('');
  const archiveRevision = useRef(0);
  const [tab, setTab] = useState<Tab>('all');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [composing, setComposing] = useState(false);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [composeError, setComposeError] = useState('');
  const revision = useRef(0);
  const openingConversation = useRef(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  const storageKey = `inbox-read:${user?.id || user?.email || ''}`;
  const s = styles(tc, isDark);

  useEffect(() => { setBundles([]); setThreads([]); setArchivedIds([]); setArchiveTarget(null); setArchiveError(''); setShowArchived(false); setReadIds([]); readIdsRef.current = []; readReady.current = false; setSelected(null); setComposing(false); }, [token]);
  const load = useCallback(async (showLoading = false) => {
    if (!token) return;
    const request = ++revision.current;
    const archiveRequest = archiveRevision.current;
    if (showLoading) setLoading(true);
    try {
      const [rows, conversations, saved, archives] = await Promise.all([ownerSharedRecordsApi.list(token), ownerInboxApi.list(token), readReady.current ? Promise.resolve(null) : AsyncStorage.getItem(storageKey), ownerInboxApi.archives(token)]);
      if (request !== revision.current || currentToken.current !== token) return;
      if (!readReady.current) {
        let ids: string[] = [];
        try { const parsed = saved ? JSON.parse(saved) : []; if (Array.isArray(parsed)) ids = parsed.filter(id => typeof id === 'string'); } catch { /* A corrupt preference must not hide clinic messages. */ }
        readIdsRef.current = ids; setReadIds(ids); readReady.current = true;
      }
      setBundles(rows); setThreads(conversations); if (archiveRequest === archiveRevision.current) setArchivedIds(archives); setError('');
    } catch (failure: any) { if (request === revision.current) setError(failure.message || 'Unable to load clinic messages.'); }
    finally { if (request === revision.current) setLoading(false); }
  }, [token, storageKey]);
  useFocusEffect(useCallback(() => {
    void load(true);
    const timer = setInterval(() => void load(), 5000);
    return () => { clearInterval(timer); revision.current++; };
  }, [load]));

  const shares: InboxItem[] = bundles.map(bundle => ({
    key: `share:${bundle.petId}:${bundle.id}`, clinicName: bundle.clinicName || 'Veterinary clinic',
    message: bundle.message?.trim() || `Records shared for ${bundle.petName || 'your pet'}.`, date: bundle.createdAt,
    records: Array.isArray(bundle.records) ? bundle.records : [], petName: bundle.petName, petId: Number(bundle.petId),
    read: readIds.includes(`share:${bundle.petId}:${bundle.id}`),
  }));
  const updates: InboxItem[] = notifications.filter(item => !/outbreak|disease|epidemic/i.test(item.type)).map(item => ({
    key: `notification:${item.id}`, notificationId: item.id, notificationType: item.type, clinicName: item.clinicName || item.title,
    message: item.message, date: item.date, records: [], read: item.read,
  }));
  const conversations: InboxItem[] = threads.map(thread => ({ key: `thread:${thread.id}`, threadId: thread.id, clinicName: thread.clinicName,
    message: thread.preview || `Start a conversation about ${thread.petName}.`, date: thread.time, petName: thread.petName, records: [], read: !thread.unread }));
  const allItems = [...conversations, ...shares, ...updates].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const items = allItems.filter(item => archivedIds.includes(item.key) === showArchived);
  const unread = items.filter(item => !item.read).length;
  const query = search.trim().toLowerCase();
  const shown = items.filter(item => (tab !== 'unread' || !item.read) && (tab !== 'updates' || !!item.notificationId) &&
    (!query || `${item.clinicName} ${item.message} ${item.petName || ''} ${item.records.map(record => record.title || '').join(' ')}`.toLowerCase().includes(query)));

  const confirmArchive = async () => {
    if (!token || !archiveTarget || archiveBusy.current) return;
    const target = archiveTarget;
    const archived = !archivedIds.includes(target.key);
    archiveBusy.current = true; setArchiving(true); setArchiveError('');
    archiveRevision.current++;
    try {
      await ownerInboxApi.archive(token, target.key, archived);
      if (currentToken.current !== token) return;
      archiveRevision.current++;
      setArchivedIds(ids => archived ? [...new Set([...ids, target.key])] : ids.filter(key => key !== target.key));
      setArchiveTarget(null);
      Toast.show({ type: 'conversationSuccess', text1: archived ? 'Conversation archived' : 'Conversation restored', text2: archived ? 'Moved to Archived conversations.' : 'The conversation is back in your inbox.' });
    } catch (failure: any) {
      if (currentToken.current === token) setArchiveError(failure.message || 'Unable to update this conversation.');
    } finally { archiveBusy.current = false; setArchiving(false); }
  };

  const markItemRead = async (item: InboxItem) => {
    if (item.read) return;
    try {
      if (item.notificationId) await markRead(item.notificationId);
      else {
        const next = [...new Set([...readIdsRef.current, item.key])];
        readIdsRef.current = next; setReadIds(next);
        const write = storageWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(next)));
        storageWrites.current = write;
        await write;
      }
    } catch (failure: any) { setError(failure.message || 'Unable to save read status.'); }
  };
  const openItem = async (item: InboxItem, record?: any) => {
    if (item.threadId) {
      navigation.navigate('ClinicConversation', { threadId: item.threadId, thread: threads.find(thread => thread.id === item.threadId) });
      return;
    }
    if (!record && item.petId && token) {
      if (openingConversation.current) return;
      openingConversation.current = true;
      try {
        const thread = threads.find(thread => thread.petId === item.petId) || await ownerInboxApi.create(token, item.petId);
        if (currentToken.current !== token) return;
        setThreads(items => [thread, ...items.filter(item => item.id !== thread.id)]);
        await markItemRead(item);
        navigation.navigate('ClinicConversation', { threadId: thread.id, thread });
      } catch (failure: any) { setError(failure.message || 'Unable to open this conversation.'); }
      finally { openingConversation.current = false; }
      return;
    }
    setSelected(item); setSelectedRecord(record || null);
    await markItemRead(item);
  };
  const openCompose = async () => {
    setComposing(true); setLoadingClinics(true); setComposeError('');
    try { if (!token) return; const care = await ownerCareApi.overview(token); if (currentToken.current === token) setClinics(care.clinicPets); }
    catch (failure: any) { setComposeError(failure.message || 'Unable to load clinic contacts.'); }
    finally { setLoadingClinics(false); }
  };
  const contact = async (patient: any) => {
    if (!token || loadingClinics) return;
    setLoadingClinics(true); setComposeError('');
    try {
      const thread = await ownerInboxApi.create(token, Number(patient.id));
      if (currentToken.current !== token) return;
      setThreads(items => [thread, ...items.filter(item => item.id !== thread.id)]); setComposing(false);
      navigation.navigate('ClinicConversation', { threadId: thread.id, thread });
    } catch (failure: any) { setComposeError(failure.message || 'Unable to open this conversation.'); }
    finally { setLoadingClinics(false); }
  };

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <HeaderSurface>
      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Home' })} style={s.back}><Ionicons name="arrow-back" size={25} color={colors.ink} /></TouchableOpacity>
          <Text style={s.title}>Inbox</Text>
          <TouchableOpacity accessibilityLabel="Search inbox" accessibilityState={{ expanded: searching }} onPress={() => { setSearching(!searching); setSearch(''); }} style={s.headerButton}><Ionicons name="search-outline" size={28} color={colors.ink} /></TouchableOpacity>
          <NotificationButton />
        </View>
        <Text style={s.subtitle}>Messages and shared records from your clinic.</Text>
      </View>
    </HeaderSurface>
    <View style={s.panel}>
      <View style={s.tabs} accessibilityRole="tablist">
        {([{ id: 'all', label: `All (${items.length})` }, { id: 'unread', label: `Unread (${unread})` }, { id: 'updates', label: 'Clinic Updates' }] as const).map(option => <TouchableOpacity key={option.id} accessibilityRole="tab" accessibilityState={{ selected: tab === option.id }} onPress={() => setTab(option.id)} style={[s.tab, tab === option.id && s.activeTab]}><Text style={[s.tabText, tab === option.id && s.activeTabText]}>{option.label}</Text></TouchableOpacity>)}
      </View>
      {searching && <View style={s.searchBox}><Ionicons name="search-outline" size={20} color={tc.textSecondary} /><TextInput accessibilityLabel="Search inbox messages" autoFocus placeholder="Search clinic, pet, or message" placeholderTextColor={tc.textMuted} value={search} onChangeText={setSearch} style={s.searchInput} /><TouchableOpacity accessibilityLabel="Close inbox search" onPress={() => { setSearch(''); setSearching(false); }}><Ionicons name="close" size={21} color={tc.textSecondary} /></TouchableOpacity></View>}
      {!!error && <TouchableOpacity onPress={() => { void load(true); void refreshNotifications(); }} style={s.errorBox}><Text style={s.error}>{error} Tap to retry.</Text></TouchableOpacity>}
      <TouchableOpacity accessibilityRole="button" onPress={() => { setShowArchived(!showArchived); setTab('all'); }} style={s.errorBox}><Text style={{ color: isDark ? colors.chart2 : GREEN, fontWeight: '600' }}>{showArchived ? 'Back to inbox' : 'Archived conversations'}</Text></TouchableOpacity>
      <FlatList data={shown} keyExtractor={item => item.key} refreshing={loading} onRefresh={() => { void load(true); void refreshNotifications(); }} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <TouchableOpacity accessibilityLabel={`Open message from ${item.clinicName}`} style={[s.card, !item.read && s.unreadCard]} onPress={() => void openItem(item)} onLongPress={() => { setArchiveTarget(item); setArchiveError(''); }} delayLongPress={250} accessibilityHint="Long press to archive or restore this conversation.">
        <LinearGradient colors={gradients.brand} style={s.avatar}><Text style={s.initials}>{initials(item.clinicName)}</Text></LinearGradient>
        <View style={s.cardContent}>
          <View style={s.cardHeading}>{!item.read && <View style={s.unreadDot} />}<Text style={s.clinicName} numberOfLines={1}>{item.clinicName}</Text><Text style={s.time}>{timestamp(item.date)}</Text></View>
          <Text style={s.message} numberOfLines={2}>{item.message}</Text>
          {!!item.records.length && <View style={s.chips}>{item.records.map((record, index) => { const tag = chip(record); return <TouchableOpacity key={`${record.id || index}:${index}`} accessibilityLabel={`Open ${tag.label}: ${record.title || ''}`} style={s.chip} onPress={() => void openItem(item, record)}><Ionicons name={tag.icon} size={15} color={GREEN} /><Text style={s.chipText}>{tag.label}</Text></TouchableOpacity>; })}</View>}
          {!item.records.length && /appointment|vacci|vaccine|lab|test|result/i.test(item.notificationType || '') && <View style={s.chips}><TouchableOpacity accessibilityLabel={`Open ${chip({ type: item.notificationType }).label} notification`} style={s.chip} onPress={() => void openItem(item)}><Ionicons name={chip({ type: item.notificationType }).icon} size={15} color={GREEN} /><Text style={s.chipText}>{chip({ type: item.notificationType }).label}</Text></TouchableOpacity></View>}
        </View>
        <Ionicons name="chevron-forward" size={21} color={tc.text} style={s.chevron} />
      </TouchableOpacity>} ListEmptyComponent={<View style={s.empty}>{loading ? <ActivityIndicator color={GREEN} /> : <Ionicons name="mail-outline" size={40} color={tc.textMuted} />}<Text style={s.emptyTitle}>{loading ? 'Loading your inbox...' : query ? 'No matching messages' : tab === 'unread' ? 'You’re all caught up' : tab === 'updates' ? 'No clinic updates yet' : showArchived ? 'No archived conversations' : 'No messages yet'}</Text>{!loading && <Text style={s.emptyText}>{query ? 'Try another clinic, pet, or search term.' : 'Messages and shared records from your clinic will appear here.'}</Text>}</View>} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Compose message to a clinic" style={s.compose} onPress={() => void openCompose()}><LinearGradient colors={gradients.brand} style={s.composeGradient}><Ionicons name="create-outline" size={35} color={colors.white} /></LinearGradient></TouchableOpacity>
    </View>

    <ArchiveDialog visible={!!archiveTarget}
      title={showArchived ? 'Restore conversation?' : 'Archive conversation?'}
      subject={archiveTarget?.clinicName}
      description={showArchived ? 'This conversation will be moved back to your inbox. You can archive it again anytime.' : 'This conversation will be moved to Archived and removed from your inbox. You can restore it anytime.'}
      confirmLabel={showArchived ? 'Restore conversation' : 'Archive conversation'}
      busy={archiving} error={archiveError} onConfirm={() => void confirmArchive()} onCancel={() => setArchiveTarget(null)} />

    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => { setSelected(null); setSelectedRecord(null); }}>
      <View style={s.backdrop}><View style={s.sheet}><View style={s.sheetHeader}><Text style={s.sheetTitle}>{selectedRecord ? chip(selectedRecord).label : selected?.clinicName}</Text><TouchableOpacity accessibilityLabel="Close message details" onPress={() => { setSelected(null); setSelectedRecord(null); }}><Ionicons name="close" size={25} color={tc.text} /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={s.detailContent}>
          <Text style={s.detailClinic}>{selected?.clinicName}</Text><Text style={s.detailMeta}>{[selected?.petName, selected ? timestamp(selected.date) : ''].filter(Boolean).join(' · ')}</Text>
          {selectedRecord ? <><Text style={s.recordTitle}>{selectedRecord.title || chip(selectedRecord).label}</Text><Text style={s.detailBody}>{selectedRecord.detail || 'No additional details recorded.'}</Text>{!!selectedRecord.date && <Text style={s.detailMeta}>{timestamp(selectedRecord.date)}</Text>}</> : <><Text style={s.detailBody}>{selected?.message}</Text>{selected?.records.map((record, index) => <TouchableOpacity key={`${record.id || index}:${index}`} style={s.recordRow} onPress={() => setSelectedRecord(record)}><Ionicons name={chip(record).icon} size={21} color={GREEN} /><View style={{ flex: 1 }}><Text style={s.recordTitle}>{record.title || chip(record).label}</Text><Text style={s.detailMeta}>{chip(record).label}</Text></View><Ionicons name="chevron-forward" size={20} color={tc.textSecondary} /></TouchableOpacity>)}</>}
          {!!selected?.notificationId && <TouchableOpacity style={s.primaryButton} onPress={() => { setSelected(null); navigation.navigate('Notifications'); }}><Text style={s.primaryText}>Open notification</Text></TouchableOpacity>}
        </ScrollView>
      </View></View>
    </Modal>
    <Modal visible={composing} transparent animationType="slide" onRequestClose={() => setComposing(false)}><View style={s.backdrop}><View style={s.sheet}><View style={s.sheetHeader}><Text style={s.sheetTitle}>New message</Text><TouchableOpacity accessibilityLabel="Close clinic contacts" onPress={() => setComposing(false)}><Ionicons name="close" size={25} color={tc.text} /></TouchableOpacity></View><Text style={s.contactDescription}>Choose a linked patient to message their clinic.</Text>{!!composeError && <Text style={[s.error, s.contactDescription]}>{composeError}</Text>}<FlatList data={clinics} keyExtractor={clinic => String(clinic.id)} contentContainerStyle={s.detailContent} renderItem={({ item }) => <TouchableOpacity disabled={loadingClinics} style={s.recordRow} onPress={() => void contact(item)}><Ionicons name="chatbubble-outline" size={22} color={GREEN} /><View style={{ flex: 1 }}><Text style={s.recordTitle}>{item.name}</Text><Text style={s.detailMeta}>{item.clinic_name}</Text></View><Ionicons name="chevron-forward" size={20} color={tc.textSecondary} /></TouchableOpacity>} ListEmptyComponent={<View style={s.empty}>{loadingClinics && <ActivityIndicator color={GREEN} />}<Text style={s.emptyText}>{loadingClinics ? 'Loading linked patients...' : 'No linked clinic patients yet. Register your pet with a clinic to start messaging.'}</Text></View>} /></View></View></Modal>
  </SafeAreaView>;
}

const styles = (tc: any, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background }, header: { height: 80, overflow: 'hidden' }, headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 40, paddingTop: 4 }, back: { width: 44, justifyContent: 'center' }, title: { flex: 1, color: colors.ink, fontSize: 26, lineHeight: 33, fontWeight: '700' }, headerButton: { padding: 6, marginLeft: 13 }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginLeft: 65 },
  panel: { ...roundedScreenPanel, backgroundColor: dark ? tc.background : colors.white }, tabs: { flexDirection: 'row', gap: 7, marginHorizontal: 26, marginTop: 20, marginBottom: 19 }, tab: { flex: 1, minHeight: 39, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: dark ? tc.surface : colors.hoverRow, borderWidth: 1, borderColor: dark ? tc.border : colors.border }, activeTab: { backgroundColor: GREEN, borderColor: GREEN }, tabText: { color: tc.text, fontSize: 13, fontWeight: '600' }, activeTabText: { color: colors.white, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 105 }, card: { flexDirection: 'row', padding: 15, paddingBottom: 11, paddingRight: 31, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: dark ? tc.border : colors.neutralBg, backgroundColor: dark ? tc.surface : colors.hoverRow, minHeight: 99, shadowColor: '#000000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 }, unreadCard: { backgroundColor: dark ? colors.ink : colors.primarySoft, borderColor: dark ? colors.dark.border : colors.neutralBg }, avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 0 }, initials: { color: colors.white, fontSize: 18, fontWeight: '600' }, cardContent: { flex: 1, marginLeft: 15 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -3 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }, clinicName: { flex: 1, fontSize: 17, lineHeight: 21, fontWeight: '700', color: tc.text }, time: { color: tc.textSecondary, fontSize: 12, lineHeight: 18, marginLeft: 4 }, message: { color: tc.text, fontSize: 14, lineHeight: 19, marginTop: 1 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 7 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: dark ? tc.border : colors.border, backgroundColor: dark ? colors.dark.textSecondary : colors.hoverRow, paddingHorizontal: 8, paddingVertical: 5 }, chipText: { color: colors.ink, fontSize: 11 }, chevron: { position: 'absolute', right: 9, top: '50%' },
  searchBox: { marginHorizontal: 16, marginBottom: 15, borderWidth: 1, borderColor: tc.border, borderRadius: 12, flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 12, backgroundColor: tc.surface }, searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: tc.text }, errorBox: { paddingHorizontal: 20, paddingBottom: 12 }, error: { color: dark ? colors.dangerTextDark : colors.dangerText, fontSize: 13 }, empty: { alignItems: 'center', padding: 30, gap: 12 }, emptyTitle: { color: tc.text, fontSize: 16, fontWeight: '700' }, emptyText: { color: tc.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }, compose: { position: 'absolute', right: 20, bottom: 28, borderRadius: 23, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5 }, composeGradient: { width: 65, height: 65, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }, sheet: { maxHeight: '85%', backgroundColor: tc.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 22, paddingBottom: 28 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingBottom: 15 }, sheetTitle: { color: tc.text, fontSize: 20, fontWeight: '700', flex: 1 }, detailContent: { paddingHorizontal: 22, paddingBottom: 18 }, detailClinic: { color: tc.text, fontSize: 17, fontWeight: '700' }, detailMeta: { color: tc.textSecondary, fontSize: 12, lineHeight: 18 }, detailBody: { color: tc.text, fontSize: 14, lineHeight: 22, marginVertical: 16 }, recordTitle: { color: tc.text, fontSize: 15, fontWeight: '600', marginTop: 4 }, recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: tc.border }, primaryButton: { backgroundColor: GREEN, borderRadius: 10, alignItems: 'center', padding: 13, marginTop: 15 }, primaryText: { color: colors.white, fontWeight: '700' }, contactDescription: { marginHorizontal: 22, marginBottom: 10, color: tc.textSecondary, fontSize: 13, lineHeight: 20 },
});
