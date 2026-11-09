import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { mockClinics, Clinic } from '../data/mockData';

type Sort = 'distance' | 'rating' | 'name';

export default function NearbyClinicsScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const [sort, setSort] = useState<Sort>('distance');
  const [fav, setFav] = useState<string[]>([]);
  const s = styles(tc, isDark);

  const sorted = [...mockClinics].sort((a, b) => {
    if (sort === 'rating') return b.rating - a.rating;
    if (sort === 'name') return a.name.localeCompare(b.name);
    return a.distance - b.distance;
  });

  const call = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => Toast.show({ type: 'error', text1: 'Cannot make call' }));
  };

  const directions = (clinic: Clinic) => {
    const query = encodeURIComponent(clinic.address);
    Linking.openURL(`https://maps.google.com/?q=${query}`).catch(() => Toast.show({ type: 'error', text1: 'Cannot open maps' }));
  };

  const toggleFav = (id: string) => {
    setFav(p => p.includes(id) ? p.filter(f => f !== id) : [...p, id]);
    Toast.show({ type: 'success', text1: fav.includes(id) ? 'Removed from favorites' : 'Added to favorites' });
  };

  const bookAt = (clinic: Clinic) => {
    navigation.navigate('BookAppointment');
  };

  const Card = ({ item }: { item: Clinic }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.clinicIcon, { backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF' }]}>
          <Ionicons name="medkit" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.clinicName}>{item.name}</Text>
          <Text style={s.address}>{item.address}</Text>
          <View style={s.metaRow}>
            <View style={s.metaItem}><Ionicons name="star" size={13} color="#F59E0B" /><Text style={s.metaText}>{item.rating}</Text></View>
            <View style={s.metaDot} />
            <View style={s.metaItem}><Ionicons name="navigate-outline" size={13} color={tc.textSecondary} /><Text style={s.metaText}>{item.distance}</Text></View>
          </View>
        </View>
        <TouchableOpacity onPress={() => toggleFav(item.id)}>
          <Ionicons name={fav.includes(item.id) ? 'heart' : 'heart-outline'} size={22} color={fav.includes(item.id) ? colors.danger : tc.textMuted} />
        </TouchableOpacity>
      </View>

      {item.specialties && (
        <View style={s.servicesRow}>
          {item.specialties.slice(0, 3).map(sv => (
            <View key={sv} style={s.serviceTag}><Text style={s.serviceText}>{sv}</Text></View>
          ))}
          {item.specialties.length > 3 && <Text style={s.moreServices}>+{item.specialties.length - 3} more</Text>}
        </View>
      )}

      <View style={s.actionRow}>
        <TouchableOpacity style={s.actionBtn} onPress={() => call(item.phone)}>
          <Ionicons name="call-outline" size={16} color={colors.success} />
          <Text style={[s.actionText, { color: colors.success }]}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => directions(item)}>
          <Ionicons name="navigate-outline" size={16} color={colors.primary} />
          <Text style={[s.actionText, { color: colors.primary }]}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.bookBtn]} onPress={() => bookAt(item)}>
          <Ionicons name="calendar" size={16} color="#fff" />
          <Text style={[s.actionText, { color: '#fff' }]}>Book</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.pageHeader}>
        <View><Text style={s.pageTitle}>Nearby Clinics</Text><Text style={s.pageSub}>Find veterinary care near you</Text></View>
      </View>

      <View style={s.sortRow}>
        <Text style={s.sortLabel}>Sort by:</Text>
        {(['distance', 'rating', 'name'] as Sort[]).map(sv => (
          <TouchableOpacity key={sv} style={[s.sortBtn, sort === sv && s.sortBtnActive]} onPress={() => setSort(sv)}>
            <Text style={[s.sortText, sort === sv && s.sortTextActive]}>{sv.charAt(0).toUpperCase() + sv.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="location-outline" size={48} color={tc.textMuted} />
            <Text style={s.emptyText}>No clinics found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  pageHeader: { padding: spacing.md, paddingBottom: 0 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: tc.text },
  pageSub: { fontSize: 14, color: tc.textSecondary },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 12 },
  sortLabel: { fontSize: 13, color: tc.textSecondary, marginRight: 4 },
  sortBtn: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { fontSize: 13, color: tc.textSecondary },
  sortTextActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: tc.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  clinicIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  clinicName: { fontSize: 15, fontWeight: '700', color: tc.text, marginBottom: 3 },
  address: { fontSize: 13, color: tc.textSecondary, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: tc.textSecondary },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: tc.textMuted },
  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  serviceTag: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  serviceText: { fontSize: 11, color: tc.textSecondary },
  moreServices: { fontSize: 11, color: tc.textMuted, alignSelf: 'center' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingVertical: 9 },
  bookBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginTop: 12 },
});
