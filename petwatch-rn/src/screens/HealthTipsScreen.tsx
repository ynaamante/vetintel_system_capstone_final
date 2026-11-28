import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView, TextInput, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { careTips, CareTip } from '../data/careTips';
import { colors } from '../theme/colors';

const GREEN = colors.primary;
function TipIcon({ tip, size = 26 }: { tip: CareTip; size?: number }) {
  if (tip.icon === 'exercise') return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={colors.deepForest} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="m3 17 4-2 6 1 6-5 1-6 3 3 4 1 2 4-4 2-4-1-3 7-5 1-3 7H7l2-9-3 1-3 6H1l2-10ZM3 11H0M5 7H2" /></Svg>;
  if (tip.icon === 'dental') return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.deepForest} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 4C9 1 4 3 5 8c.4 2 1.8 3.7 2 6 .2 3 1 6 2.3 6 1 0 1-6 2.7-6s1.7 6 2.7 6C16 20 16.8 17 17 14c.2-2.3 1.6-4 2-6 1-5-4-7-7-4ZM9 4l4 2" /></Svg>;
  if (tip.icon === 'emergency') return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.deepForest} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 3v5a5 5 0 0 0 10 0V3M4 3h3M13 3h3M10 13v3a4 4 0 0 0 8 0v-2" /><Path d="M20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" /></Svg>;
  const icons: Record<CareTip['icon'], keyof typeof Ionicons.glyphMap> = { exercise: 'walk-outline', water: 'water-outline', grooming: 'brush-outline', dental: 'medical-outline', food: 'nutrition-outline', weight: 'scale-outline', play: 'tennisball-outline', paw: 'paw-outline', vet: 'medkit-outline', shield: 'shield-checkmark-outline', illness: 'pulse-outline', emergency: 'medkit-outline' };
  return <Ionicons name={icons[tip.icon]} size={size} color={colors.deepForest} />;
}
export default function HealthTipsScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const { user } = useAuth();
  const [fontLoaded] = useFonts({ VetIntelCareBold: require('../assets/fonts/Lato-Bold.ttf') });
  const bold = { fontFamily: fontLoaded ? 'VetIntelCareBold' : undefined, fontWeight: fontLoaded ? 'normal' as const : '700' as const };
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CareTip | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const savedRef = useRef<string[]>([]);
  const writes = useRef(Promise.resolve());
  const storageKey = 'health-tips-saved:' + (user?.id || user?.email || '');
  const currentKey = useRef(storageKey);
  currentKey.current = storageKey;
  const s = styles(tc, isDark);
  useEffect(() => {
    let active = true;
    setReady(false); setSaved([]); savedRef.current = [];
    void AsyncStorage.getItem(storageKey).then(value => {
      if (!active) return;
      let ids: string[] = [];
      try { const parsed = JSON.parse(value || '[]'); if (Array.isArray(parsed)) ids = parsed.filter(id => typeof id === 'string' && careTips.some(tip => tip.id === id)); } catch {}
      savedRef.current = ids; setSaved(ids); setReady(true);
    }).catch(() => { if (active) { setReady(true); Toast.show({ type: 'error', text1: 'Unable to load saved tips.' }); } });
    return () => { active = false; };
  }, [storageKey]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [selected]));
  const toggleSave = (id: string) => {
    if (!ready) return;
    const next = savedRef.current.includes(id) ? savedRef.current.filter(value => value !== id) : [...savedRef.current, id];
    savedRef.current = next; setSaved(next);
    const key = storageKey;
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next))).catch(() => {
      if (currentKey.current === key) Toast.show({ type: 'error', text1: 'Unable to save this preference. Please try again.' });
    });
  };
  const openLink = async (url: string) => {
    try { await Linking.openURL(url); } catch { Toast.show({ type: 'error', text1: 'Unable to open the reference.' }); }
  };
  const back = () => { if (selected) setSelected(null); else if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('HomeOverview'); };
  const query = search.trim().toLowerCase();
  const shown = careTips.filter(tip => tip.id !== 'emergency' && (category === 'All' || tip.category === category) && (!savedOnly || saved.includes(tip.id)) && (!query || [tip.title, tip.listTitle, tip.category, tip.preview, tip.why, ...tip.guidance, tip.when].join(' ').toLowerCase().includes(query)));
  const emergency = careTips.find(tip => tip.id === 'emergency')!;
  const section = (title: string, content: React.ReactNode) => <View style={s.detailSection}><Text style={[s.sectionTitle, bold]}>{title}</Text>{content}</View>;
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <AppHeader title="Health Tips" subtitle={selected ? 'Simple care guidance for your pets' : 'Practical care guidance for your pets'} onBack={back} />
    <View style={s.panel}>
      {selected ? <ScrollView key={selected.id} contentContainerStyle={s.detail}>
        <View style={s.detailHeading}><View style={s.detailIcon}><TipIcon tip={selected} size={46} /></View><View style={{ flex: 1 }}><Text style={[s.detailCategory, bold]}>{selected.category.toUpperCase()}</Text><Text style={[s.detailTitle, bold]}>{selected.title}</Text></View></View>
        {section('Why it matters', <Text style={s.body}>{selected.why}</Text>)}
        {section('Basic guidance', <View style={s.bullets}>{selected.guidance.map(line => <View key={line} style={s.bulletRow}><Text style={s.bullet}>•</Text><Text style={[s.body, { flex: 1 }]}>{line}</Text></View>)}</View>)}
        {section('When to ask your vet', <Text style={s.body}>{selected.when}</Text>)}
        <Text style={s.disclaimer}>General guidance only. For personalized advice, follow your veterinarian’s recommendations.</Text>
        <TouchableOpacity accessibilityRole="button" style={s.contact} onPress={() => navigation.navigate('Messages')}><Ionicons name="call-outline" size={21} color={GREEN} /><Text style={[s.contactText, bold]}>Contact your clinic</Text></TouchableOpacity>
        {selected.id === 'emergency' && <Text style={s.urgent}>For emergencies, call or visit a veterinary clinic immediately. Do not wait for an inbox reply.</Text>}
        {!!selected.source && <TouchableOpacity accessibilityRole="link" onPress={() => void openLink(selected.source!.url)} style={s.source}><Text style={s.sourceText}>{selected.source.title} ↗</Text></TouchableOpacity>}
      </ScrollView> : <>
        <View style={s.search}><Ionicons name="search-outline" size={20} color={tc.textMuted} /><TextInput accessibilityLabel="Search health tips" value={search} onChangeText={setSearch} placeholder="Search health tips" placeholderTextColor={tc.textMuted} style={s.input} />{!!search && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={tc.textMuted} /></TouchableOpacity>}</View>
        <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>{['All', 'Nutrition', 'Exercise', 'Grooming', 'Dental', 'General', 'Safety'].map(cat => <TouchableOpacity key={cat} accessibilityRole="button" accessibilityState={{ selected: cat === category }} onPress={() => setCategory(cat)} style={[s.category, cat === category && s.categoryActive]}><Text style={[s.categoryText, cat === category && { color: colors.white }]}>{cat}</Text></TouchableOpacity>)}</ScrollView></View>
        <View style={s.listHeading}><Text style={[s.listTitle, bold]}>{savedOnly ? 'Saved tips' : 'Care essentials'}</Text><TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: savedOnly }} onPress={() => setSavedOnly(!savedOnly)} style={s.saved}><Ionicons name={savedOnly ? 'bookmark' : 'bookmark-outline'} size={17} color={isDark ? colors.dark.textSecondary : GREEN} /><Text style={s.savedText}>{savedOnly ? 'All tips' : 'Saved'}</Text></TouchableOpacity></View>
        <FlatList data={shown} keyExtractor={tip => tip.id} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list} renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Read ' + item.listTitle} style={s.card} onPress={() => setSelected(item)}>
          <View style={s.cardIcon}><TipIcon tip={item} /></View><View style={s.cardText}><Text style={[s.cardTitle, bold]}>{item.listTitle}</Text><Text style={s.cardCategory}>{item.category}</Text><Text numberOfLines={2} style={s.preview}>{item.preview}</Text></View>
          <TouchableOpacity disabled={!ready} accessibilityRole="button" accessibilityLabel={(saved.includes(item.id) ? 'Unsave ' : 'Save ') + item.listTitle} accessibilityState={{ selected: saved.includes(item.id) }} onPress={event => { event.stopPropagation(); toggleSave(item.id); }} style={s.bookmark}><Ionicons name={saved.includes(item.id) ? 'bookmark' : 'bookmark-outline'} size={17} color={tc.textSecondary} /></TouchableOpacity><Ionicons name="chevron-forward" size={18} color={tc.text} />
        </TouchableOpacity>} ListEmptyComponent={<View style={s.empty}><Ionicons name={savedOnly ? 'bookmark-outline' : 'search-outline'} size={32} color={tc.textMuted} /><Text style={s.emptyText}>{savedOnly ? 'No saved tips match your filters.' : 'No tips match your search.'}</Text></View>} ListFooterComponent={<>
          <TouchableOpacity accessibilityRole="button" style={s.vetCallout} onPress={() => setSelected(emergency)}><View style={s.calloutIcon}><TipIcon tip={emergency} size={25} /></View><View style={{ flex: 1 }}><Text style={[s.calloutTitle, bold]}>When to call your vet</Text><Text style={s.preview}>{emergency.preview}</Text></View><Ionicons name="chevron-forward" size={18} color={tc.text} /></TouchableOpacity>
          <Text style={s.footer}>General guidance · Follow your veterinarian’s advice</Text>
        </>} />
      </>}
    </View>
  </SafeAreaView>;
}
const styles = (tc: any, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  panel: { ...roundedScreenPanel, backgroundColor: tc.background },
  search: { marginHorizontal: 15, marginTop: 16, minHeight: 34, borderRadius: 18, borderWidth: 1, borderColor: tc.border, backgroundColor: dark ? tc.surface : colors.neutralBg, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, color: tc.text, paddingVertical: 7 },
  categories: { paddingHorizontal: 15, paddingTop: 11, paddingBottom: 16, gap: 8 },
  category: { minWidth: 66, minHeight: 29, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: tc.border, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 5, backgroundColor: tc.surface },
  categoryActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { fontSize: 13, color: tc.text },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, paddingBottom: 12 },
  listTitle: { fontSize: 20, lineHeight: 27, color: tc.text },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 },
  savedText: { color: dark ? colors.dark.textSecondary : GREEN, fontSize: 14 },
  list: { paddingHorizontal: 15, paddingBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: tc.border, paddingVertical: 8, paddingRight: 8, marginBottom: 8, backgroundColor: tc.surface, minHeight: 68 },
  cardIcon: { width: 57, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, borderLeftWidth: 1, borderLeftColor: tc.border, paddingLeft: 11 },
  cardTitle: { color: tc.text, fontSize: 15, lineHeight: 20 },
  cardCategory: { color: tc.textSecondary, fontSize: 12, lineHeight: 16 },
  preview: { color: tc.textSecondary, fontSize: 13, lineHeight: 18 },
  bookmark: { alignSelf: 'flex-start', padding: 8, marginTop: -5, marginLeft: 3 },
  vetCallout: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: dark ? colors.primarySoftDark : colors.hoverMenu, borderRadius: 11, marginTop: 8, paddingVertical: 10, paddingRight: 9 },
  calloutIcon: { width: 57, alignItems: 'center', borderRightWidth: 1, borderRightColor: dark ? tc.border : colors.border },
  calloutTitle: { color: dark ? colors.dark.textSecondary : colors.ink, fontSize: 14, lineHeight: 19 },
  footer: { color: tc.textSecondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 5, paddingTop: 10 },
  empty: { padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { color: tc.textSecondary, fontSize: 15, textAlign: 'center' },
  detail: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 30 },
  detailHeading: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 16 },
  detailIcon: { width: 66, height: 66, borderRadius: 15, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  detailCategory: { color: dark ? colors.dark.textSecondary : colors.textMuted, fontSize: 14, lineHeight: 20 },
  detailTitle: { color: tc.text, fontSize: 26, lineHeight: 33 },
  detailSection: { borderTopWidth: 1, borderTopColor: tc.border, paddingTop: 12, paddingBottom: 16 },
  sectionTitle: { color: dark ? colors.dark.textSecondary : colors.ink, fontSize: 20, lineHeight: 27, marginBottom: 3 },
  body: { color: tc.text, fontSize: 16, lineHeight: 23 },
  bullets: { gap: 2 },
  bulletRow: { flexDirection: 'row', gap: 9 },
  bullet: { color: tc.text, fontSize: 18, lineHeight: 23 },
  disclaimer: { borderTopWidth: 1, borderTopColor: tc.border, paddingTop: 15, paddingBottom: 23, color: tc.textSecondary, fontSize: 14, lineHeight: 21 },
  contact: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.success, borderRadius: 12, backgroundColor: dark ? colors.primarySoft : tc.surface },
  contactText: { color: colors.successText, fontSize: 16 },
  urgent: { color: dark ? colors.dangerTextDark : colors.dangerText, fontSize: 15, lineHeight: 22, marginTop: 12 },
  source: { paddingVertical: 14 },
  sourceText: { color: dark ? colors.dark.textSecondary : GREEN, fontSize: 13, textDecorationLine: 'underline' },
});
