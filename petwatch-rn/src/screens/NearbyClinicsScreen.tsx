import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Linking, StyleSheet, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { clinicsApi } from '../services/api';
import { colors } from '../theme/colors';

const GREEN = colors.primary;
const LOCATION_KEY = 'nearby-clinics-search-location';
type SearchLocation = { label: string; latitude: number; longitude: number };
type Clinic = { id: string | number; name: string; address?: string; phone?: string; is_connected: boolean; emergency_care: boolean; latitude: number | null; longitude: number | null; distance_km: number | null };
type Filter = 'nearest' | 'connected' | 'emergency';
const DEFAULT_LOCATION: SearchLocation = { label: 'Sta. Maria, Bulacan', latitude: 14.818, longitude: 120.956 };
const geocodedAddresses = new Map<string, { latitude: number; longitude: number }>();
const distance = (origin: SearchLocation, point: { latitude: number; longitude: number }) => {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(point.latitude - origin.latitude) / 2) ** 2 + Math.cos(rad(origin.latitude)) * Math.cos(rad(point.latitude)) * Math.sin(rad(point.longitude - origin.longitude) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
};

export default function NearbyClinicsScreen() {
  const { token } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('nearest');
  const [location, setLocation] = useState<SearchLocation>(DEFAULT_LOCATION);
  const [restored, setRestored] = useState(false);
  const [changingLocation, setChangingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const revision = useRef(0);
  const locationRevision = useRef(0);
  const shouldLocateOnOpen = useRef(true);
  const s = styles(tc, isDark);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LOCATION_KEY).then(value => {
      if (!active || !value) return;
      const saved = JSON.parse(value);
      if (typeof saved.label === 'string' && typeof saved.latitude === 'number' && Math.abs(saved.latitude) <= 90 && typeof saved.longitude === 'number' && Math.abs(saved.longitude) <= 180) {
        shouldLocateOnOpen.current = false;
        setLocation(saved);
      }
    }).catch(() => {}).finally(() => { if (active) setRestored(true); });
    return () => { active = false; locationRevision.current++; };
  }, []);

  const load = useCallback(async () => {
    if (!token || !restored) return;
    const request = ++revision.current;
    setLoading(true);
    try {
      const rows: Clinic[] = await clinicsApi.getNearby(token, location.latitude, location.longitude);
      if (request !== revision.current) return;
      setClinics(rows); setError('');
      // Native geocoding fills gaps for clinics whose stored address has no coordinates.
      // Cache each address so pull-to-refresh does not repeatedly geocode it.
      const permission = Platform.OS === 'web' ? null : await Location.getForegroundPermissionsAsync();
      if (permission?.granted) {
        const located: Clinic[] = [];
        for (const row of rows) {
          if (request !== revision.current) return;
          let point = row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : undefined;
          if (!point && row.address) {
            point = geocodedAddresses.get(row.address);
            if (!point) {
              try { const matches = await Location.geocodeAsync(row.address); if (matches[0]) { point = matches[0]; geocodedAddresses.set(row.address, point); } } catch { /* Keep the clinic available even when its address cannot be located. */ }
            }
          }
          located.push(point ? { ...row, ...point, distance_km: distance(location, point) } : row);
        }
        if (request === revision.current) setClinics(located);
      }
    } catch (failure: any) { if (request === revision.current) setError(failure.message || 'Unable to load clinics.'); }
    finally { if (request === revision.current) setLoading(false); }
  }, [token, restored, location]);
  useFocusEffect(useCallback(() => { void load(); return () => { revision.current++; }; }, [load]));

  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { setError('Unable to open this link on your device.'); }
  };
  const changeLocation = async (useDevice: boolean) => {
    if (locating || (!useDevice && !locationInput.trim())) return;
    const request = ++locationRevision.current;
    setLocating(true); setLocationError('');
    try {
      if (Platform.OS !== 'web' || useDevice) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Location permission is needed. Enable it in your device settings, then try again.');
      }
      let next: SearchLocation;
      if (useDevice) {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = position.coords;
        let label = 'Current location';
        if (Platform.OS !== 'web') {
          try { const [address] = await Location.reverseGeocodeAsync({ latitude, longitude }); if (address) label = [address.city || address.district, address.subregion || address.region].filter((part, index, all) => part && all.indexOf(part) === index).join(', ') || label; } catch { /* Coordinates still support nearby search. */ }
        }
        next = { label, latitude, longitude };
      } else {
        if (Platform.OS === 'web') throw new Error('Use current location on the web. Address location search is available in the mobile app.');
        const [point] = await Location.geocodeAsync(locationInput.trim());
        if (!point) throw new Error('Location not found. Try a municipality and province.');
        next = { label: locationInput.trim(), latitude: point.latitude, longitude: point.longitude };
      }
      if (request !== locationRevision.current) return;
      setLocation(next); setChangingLocation(false);
      void AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(next)).catch(() => {});
    } catch (failure: any) { if (request === locationRevision.current) setLocationError(failure.message || 'Unable to find this location.'); }
    finally { if (request === locationRevision.current) setLocating(false); }
  };

  useEffect(() => {
    if (!restored || !shouldLocateOnOpen.current || Platform.OS === 'web') return;
    shouldLocateOnOpen.current = false;
    void changeLocation(true);
  }, [restored]);

  const search = query.trim().toLocaleLowerCase();
  const shown = clinics.filter(clinic =>
    (!search || `${clinic.name} ${clinic.address || ''}`.toLocaleLowerCase().includes(search)) &&
    (filter !== 'connected' || clinic.is_connected) && (filter !== 'emergency' || clinic.emergency_care)
  ).sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity) || a.name.localeCompare(b.name));
  const destination = (clinic: Clinic) => clinic.latitude !== null && clinic.longitude !== null
    ? `${clinic.latitude},${clinic.longitude}` : `${clinic.name}, ${clinic.address}`;

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <AppHeader title="Find Nearby Clinics" compact />
    <View style={s.panel}>
      <View style={s.controls}>
        <View style={s.locationBar}>
          <Ionicons name="location" size={20} color={GREEN} />
          <Text style={s.locationText} numberOfLines={1}>Searching near <Text style={s.locationName}>{location.label}</Text></Text>
          <TouchableOpacity accessibilityLabel="Change search location" onPress={() => { setLocationInput(location.label); setLocationError(''); setChangingLocation(true); }} hitSlop={8}><Text style={s.change}>Change</Text></TouchableOpacity>
        </View>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={20} color={tc.text} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search clinic or barangay" placeholderTextColor={tc.textSecondary} style={s.searchInput} accessibilityLabel="Search clinic or barangay" returnKeyType="search" autoCorrect={false} />
          {!!query && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={tc.textMuted} /></TouchableOpacity>}
        </View>
        <View style={s.tabs} accessibilityRole="tablist">
          {([{ id: 'nearest', label: 'Nearest' }, { id: 'connected', label: 'VetIntel Clinics' }, { id: 'emergency', label: 'Emergency Care' }] as const).map(tab => <TouchableOpacity key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: filter === tab.id }} onPress={() => setFilter(tab.id)} style={[s.tab, filter === tab.id && s.tabActive]}><Text style={[s.tabText, filter === tab.id && s.tabTextActive]}>{tab.label}</Text></TouchableOpacity>)}
        </View>
        <View style={s.listHeading}>
          <Text style={s.heading}>Nearby clinics</Text>
          <TouchableOpacity style={s.mapLink} accessibilityLabel="Open nearby clinics in Maps" onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`veterinary clinics near ${location.label}`)}`)}><Ionicons name="map-outline" size={20} color={GREEN} /><Text style={s.mapText}>Map view</Text></TouchableOpacity>
        </View>
      </View>
      {!!error && <TouchableOpacity onPress={() => void load()} style={s.errorBox}><Text style={s.error}>{error} Tap to retry.</Text></TouchableOpacity>}
      <FlatList data={shown} keyExtractor={clinic => String(clinic.id)} contentContainerStyle={s.list} refreshing={loading} onRefresh={() => void load()} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <View style={s.card}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.address}>{item.address || 'Address not provided'}</Text>
        {item.is_connected && <View style={s.badge}><View style={s.badgeDot} /><Text style={s.badgeText}>VetIntel connected</Text></View>}
        {item.distance_km !== null && <Text style={s.distance}>{item.distance_km < 1 ? `${Math.round(item.distance_km * 1000)} m away` : `${item.distance_km.toFixed(1)} km away`}</Text>}
        <View style={s.actions}>
          <TouchableOpacity accessibilityLabel={`Call ${item.name}`} disabled={!item.phone} style={[s.button, s.callButton, !item.phone && s.disabled]} onPress={() => open(`tel:${item.phone!.replace(/[^+\d]/g, '')}`)}><Text style={s.callText}>{item.phone ? 'Call' : 'No phone listed'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityLabel={`Directions to ${item.name}`} disabled={!item.address && item.latitude === null} style={[s.button, s.directionsButton, !item.address && item.latitude === null && s.disabled]} onPress={() => open(`https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${encodeURIComponent(destination(item))}`)}><Text style={s.directionsText}>Directions</Text></TouchableOpacity>
        </View>
      </View>} ListEmptyComponent={<View style={s.empty}>{loading && <ActivityIndicator color={GREEN} />}<Text style={s.emptyTitle}>{loading ? 'Finding clinics...' : error ? 'Clinics could not be loaded' : 'No clinics found'}</Text>{!loading && !error && <Text style={s.emptyText}>{filter === 'emergency' ? 'No clinics currently list emergency care. Try Nearest or change your search.' : 'Try another clinic name or barangay.'}</Text>}</View>} />
    </View>
    <Modal visible={changingLocation} transparent animationType="fade" onRequestClose={() => { locationRevision.current++; setLocating(false); setChangingLocation(false); }}>
      <View style={s.modalBackdrop}><View style={s.modalCard}>
        <View style={s.modalHeading}><Text style={s.heading}>Search location</Text><TouchableOpacity accessibilityLabel="Close location selection" onPress={() => { locationRevision.current++; setLocating(false); setChangingLocation(false); }}><Ionicons name="close" size={24} color={tc.text} /></TouchableOpacity></View>
        <Text style={s.modalDescription}>Enter a municipality, province, or barangay.</Text>
        <TextInput value={locationInput} onChangeText={setLocationInput} style={[s.searchBox, s.locationInput]} placeholder="e.g. Sta. Maria, Bulacan" placeholderTextColor={tc.textMuted} accessibilityLabel="Search location" editable={!locating} onSubmitEditing={() => void changeLocation(false)} />
        {!!locationError && <Text style={s.error}>{locationError}</Text>}
        <TouchableOpacity disabled={locating || !locationInput.trim()} onPress={() => void changeLocation(false)} style={[s.modalButton, s.directionsButton, (locating || !locationInput.trim()) && s.disabled]}><Text style={s.directionsText}>Search this area</Text></TouchableOpacity>
        <TouchableOpacity disabled={locating} onPress={() => void changeLocation(true)} style={[s.modalButton, s.callButton, locating && s.disabled]}>{locating ? <ActivityIndicator color={GREEN} /> : <Ionicons name="locate-outline" size={20} color={GREEN} />}<Text style={s.callText}>{locating ? 'Finding location...' : 'Use my current location'}</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  panel: { ...roundedScreenPanel, backgroundColor: isDark ? tc.background : colors.white },
  controls: { paddingHorizontal: 14, paddingTop: 16 },
  locationBar: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: isDark ? tc.surface : colors.primarySoft },
  locationText: { flex: 1, color: tc.textSecondary, fontSize: 13 }, locationName: { color: tc.text, fontWeight: '700' }, change: { fontSize: 13, color: isDark ? colors.chart2 : GREEN, fontWeight: '700', textDecorationLine: 'underline' },
  searchBox: { minHeight: 34, borderWidth: 1, borderColor: tc.border, borderRadius: 12, backgroundColor: tc.inputBg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, marginTop: 12 },
  searchInput: { flex: 1, color: tc.text, fontSize: 13, paddingVertical: 6, minWidth: 0 },
  tabs: { flexDirection: 'row', gap: 7, marginTop: 14 },
  tab: { flex: 1, minHeight: 34, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: tc.border, backgroundColor: tc.inputBg },
  tabActive: { backgroundColor: GREEN, borderColor: GREEN }, tabText: { fontSize: 12, fontWeight: '600', color: tc.text }, tabTextActive: { color: colors.white },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 15 }, heading: { fontSize: 16, fontWeight: '700', color: tc.text }, mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6 }, mapText: { color: isDark ? colors.chart2 : GREEN, fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 14, paddingBottom: 20 },
  card: { paddingHorizontal: 15, paddingTop: 7, paddingBottom: 9, marginBottom: 7, borderWidth: 1, borderColor: isDark ? tc.border : colors.border, borderRadius: 14, backgroundColor: tc.surface },
  name: { color: tc.text, fontSize: 17, lineHeight: 20, fontWeight: '700' }, address: { color: tc.textSecondary, fontSize: 12, lineHeight: 17 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginTop: 1, backgroundColor: colors.primarySoft }, badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }, badgeText: { fontSize: 11, fontWeight: '700', color: colors.ink }, distance: { color: tc.textSecondary, fontSize: 11, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 11, borderTopWidth: 1, borderTopColor: isDark ? tc.border : colors.neutralBg, paddingTop: 7, marginTop: 6 },
  button: { flex: 1, minHeight: 28, paddingVertical: 4, paddingHorizontal: 5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, callButton: { borderWidth: 1, borderColor: GREEN }, directionsButton: { backgroundColor: GREEN }, callText: { color: isDark ? colors.chart2 : GREEN, fontSize: 13, fontWeight: '700' }, directionsText: { color: colors.white, fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.45 },
  errorBox: { paddingHorizontal: 14, paddingBottom: 12 }, error: { color: isDark ? colors.dangerTextDark : colors.dangerText, fontSize: 13, lineHeight: 19 }, empty: { paddingVertical: 35, alignItems: 'center', gap: 10 }, emptyTitle: { fontSize: 15, fontWeight: '600', color: tc.text }, emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: tc.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 22 }, modalCard: { width: '100%', maxWidth: 430, padding: 20, borderRadius: 20, backgroundColor: tc.surface }, modalHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalDescription: { color: tc.textSecondary, fontSize: 13, marginTop: 10 }, locationInput: { color: tc.text, paddingVertical: 10 }, modalButton: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
});
