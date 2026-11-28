import AppHeader from '../components/AppHeader';
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ownerCareApi } from '../services/api';

const GREEN = '#005638';
const archiveDate = (value?: string) => {
  if (!value) return 'Archive date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Archive date unavailable' : 'Archived on ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ArchivedPetsScreen() {
  const { token } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const [fontLoaded] = useFonts({ VetIntelArchiveBold: require('../assets/fonts/Lato-Bold.ttf') });
  const bold = { fontFamily: fontLoaded ? 'VetIntelArchiveBold' : undefined, fontWeight: fontLoaded ? 'normal' as const : '700' as const };
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);
  const restoreBusy = useRef(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  const revision = useRef(0);
  const s = styles(tc, isDark);
  const load = useCallback(async (active: () => boolean = () => true) => {
    if (!token) return;
    const request = ++revision.current;
    try {
      const rows = await ownerCareApi.archivedPets(token);
      if (active() && currentToken.current === token && revision.current === request) { setPets(rows); setError(''); }
    } catch (failure: any) {
      if (active() && currentToken.current === token && revision.current === request) setError(failure.message || 'Unable to load archived pets.');
    } finally {
      if (active() && currentToken.current === token && revision.current === request) setLoading(false);
    }
  }, [token]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setPets([]); setLoading(true); setError('');
    void load(() => active);
    return () => { active = false; revision.current++; };
  }, [load]));
  const restore = async (pet: any) => {
    if (!token || restoreBusy.current) return;
    restoreBusy.current = true;
    const key = pet.source + '-' + pet.id;
    setRestoring(key); revision.current++;
    try {
      await ownerCareApi.archivePet(String(pet.id), pet.source, false, token);
      if (currentToken.current !== token) return;
      revision.current++;
      setPets(rows => rows.filter(row => row.source + '-' + row.id !== key));
      setLoading(false);
      Toast.show({ type: 'conversationSuccess', text1: pet.name + ' restored', text2: 'Your pet is back in My pets.' });
    } catch (failure: any) {
      if (currentToken.current === token) Toast.show({ type: 'error', text1: failure.message || 'Unable to restore this pet.' });
    } finally { restoreBusy.current = false; setRestoring(null); }
  };
  const query = search.trim().toLowerCase();
  const shown = pets.filter(pet => [pet.name, pet.species, pet.breed, pet.clinic_name].filter(Boolean).join(' ').toLowerCase().includes(query));
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <AppHeader title="Archived pets" subtitle="Restore a pet to show it in My pets again. Medical records and appointments are kept." subtitleLines={2} />
    <View style={s.panel}>
      <View style={s.heading}><Text style={[s.headingText, bold]}>Archived pets</Text><View style={s.count}><Text style={[s.countText, bold]}>{pets.length}</Text></View></View>
      <View style={s.search}><Ionicons name="search-outline" size={21} color={tc.textSecondary} /><TextInput accessibilityLabel="Search archived pets" placeholder="Search archived pets" placeholderTextColor={tc.textMuted} value={search} onChangeText={setSearch} style={s.input} />{!!search && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={tc.textMuted} /></TouchableOpacity>}</View>
      {!!error && <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={s.error}><Text style={{ color: '#B42318' }}>{error} Tap to retry.</Text></TouchableOpacity>}
      <FlatList data={shown} keyExtractor={pet => pet.source + '-' + pet.id} refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list} renderItem={({ item }) => <View style={s.card}>
        <View style={s.petRow}>
          <View style={s.photoBox}>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={s.photo} /> : <Ionicons name="paw-outline" size={38} color="#00633D" />}</View>
          <View style={s.petInfo}>
            <View style={s.nameRow}><Text style={[s.name, bold]}>{item.name}</Text><View style={s.badge}><Ionicons name="archive-outline" size={14} color="#234D3C" /><Text style={s.badgeText}>Archived</Text></View></View>
            <Text style={s.species}>{[item.species, item.breed].filter(Boolean).join(' · ') || 'Pet profile'}</Text>
            <View style={s.dateRow}><Ionicons name="calendar-outline" size={16} color={tc.textSecondary} /><Text style={s.date}>{archiveDate(item.archived_at)}</Text></View>
          </View>
        </View>
        <View style={s.hiddenRow}><Ionicons name="information-circle-outline" size={18} color={isDark ? '#A8D8BE' : '#315547'} /><Text style={s.hiddenText}>Profile hidden from My Pets</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Restore ' + item.name} disabled={!!restoring} onPress={() => void restore(item)} style={[s.restore, !!restoring && { opacity: 0.6 }]}>{restoring === item.source + '-' + item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[s.restoreText, bold]}>Restore pet</Text>}</TouchableOpacity>
        <View style={s.keptRow}><Ionicons name="document-text-outline" size={17} color={isDark ? '#A8D8BE' : GREEN} /><Text style={s.keptText}>Medical records kept</Text></View>
      </View>} ListEmptyComponent={<View style={s.empty}>{loading ? <ActivityIndicator color={GREEN} /> : <Ionicons name={query ? 'search-outline' : 'archive-outline'} size={40} color={tc.textMuted} />}<Text style={[s.emptyTitle, bold]}>{loading ? 'Loading archived pets...' : error ? 'Unable to load pets' : query ? 'No matching pets' : 'No archived pets'}</Text>{!loading && !error && <Text style={s.emptyBody}>{query ? 'Try another pet name or breed.' : 'Pets you archive will appear here.'}</Text>}</View>} />
    </View>
  </SafeAreaView>;
}
const styles = (tc: any, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },
  panel: { flex: 1, backgroundColor: tc.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16 },
  headingText: { fontSize: 18, lineHeight: 23, color: dark ? '#A8D8BE' : '#00482B' },
  count: { minWidth: 28, paddingHorizontal: 8, height: 23, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F3E9' },
  countText: { fontSize: 13, color: '#00603B' },
  search: { marginHorizontal: 18, marginBottom: 24, minHeight: 42, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: dark ? tc.border : '#D0D2D4', backgroundColor: dark ? tc.surface : '#F8F8F8', flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontSize: 14, color: tc.text, paddingVertical: 9 },
  list: { paddingHorizontal: 13, paddingBottom: 30, flexGrow: 1 },
  card: { padding: 12, paddingTop: 18, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: dark ? tc.border : '#DCDDDF', backgroundColor: tc.surface },
  petRow: { flexDirection: 'row', alignItems: 'center' },
  photoBox: { width: 62, height: 62, borderRadius: 16, backgroundColor: '#DFF3E9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: 62, height: 62 },
  petInfo: { flex: 1, borderLeftWidth: 1, borderLeftColor: dark ? tc.border : '#D1D5D3', marginLeft: 10, paddingLeft: 11, minHeight: 62 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  name: { flex: 1, fontSize: 17, lineHeight: 21, color: tc.text },
  species: { fontSize: 12, lineHeight: 17, color: tc.textSecondary, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E8EEEA' },
  badgeText: { fontSize: 11, color: '#234D3C' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  date: { flex: 1, fontSize: 11, lineHeight: 16, color: tc.textSecondary },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17, marginBottom: 16, paddingHorizontal: 5 },
  hiddenText: { color: tc.textSecondary, fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
  restore: { minHeight: 42, borderRadius: 10, backgroundColor: '#00633D', alignItems: 'center', justifyContent: 'center', padding: 10 },
  restoreText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  keptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, marginTop: 14, marginBottom: 7 },
  keptText: { fontSize: 12, lineHeight: 17, color: dark ? '#A8D8BE' : GREEN },
  error: { paddingHorizontal: 18, paddingBottom: 12 },
  empty: { alignItems: 'center', padding: 30, gap: 12 },
  emptyTitle: { fontSize: 16, color: tc.text },
  emptyBody: { fontSize: 13, lineHeight: 19, color: tc.textSecondary, textAlign: 'center' },
});
