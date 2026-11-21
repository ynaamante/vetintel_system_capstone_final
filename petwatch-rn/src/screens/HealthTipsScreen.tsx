import AppHeader from '../components/AppHeader';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { healthTips, HealthTip } from '../data/mockData';

type Cat = 'all' | string;

const catIcon: Record<string, any> = { nutrition: 'nutrition-outline', exercise: 'walk-outline', grooming: 'cut-outline', safety: 'shield-checkmark-outline', general: 'bulb-outline' };
const catColor: Record<string, string> = { nutrition: '#22C55E', exercise: '#3B82F6', grooming: '#8B5CF6', safety: '#EF4444', general: '#F59E0B' };

export default function HealthTipsScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const [cat, setCat] = useState<Cat>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const s = styles(tc, isDark);

  const cats = ['all', ...Array.from(new Set(healthTips.map(t => t.category)))];
  const shown = cat === 'all' ? healthTips : healthTips.filter(t => t.category === cat);

  const toggleSave = (id: string) => setSaved(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const Card = ({ item }: { item: HealthTip }) => {
    const isOpen = expanded === item.id;
    const cc = catColor[item.category] || colors.primary;
    const ci = catIcon[item.category] || 'bulb-outline';
    return (
      <TouchableOpacity style={s.card} onPress={() => setExpanded(isOpen ? null : item.id)} activeOpacity={0.8}>
        <View style={s.cardTop}>
          <View style={[s.iconCircle, { backgroundColor: `${cc}22` }]}>
            <Ionicons name={ci} size={20} color={cc} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.tipTitle}>{item.title}</Text>
            <View style={[s.catBadge, { backgroundColor: `${cc}22` }]}>
              <Text style={[s.catText, { color: cc }]}>{item.category}</Text>
            </View>
          </View>
          <View style={s.rightActions}>
            <TouchableOpacity onPress={() => toggleSave(item.id)} style={s.saveBtn}>
              <Ionicons name={saved.includes(item.id) ? 'bookmark' : 'bookmark-outline'} size={18} color={saved.includes(item.id) ? colors.primary : tc.textMuted} />
            </TouchableOpacity>
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={tc.textMuted} />
          </View>
        </View>
        {!isOpen && <Text style={s.tipPreview} numberOfLines={2}>{item.description}</Text>}
        {isOpen && (
          <View style={s.expandedContent}>
            <Text style={s.tipContent}>{item.description}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <AppHeader title="Health Tips" subtitle="Expert advice for your pets" /><View style={[s.savedChip, { alignSelf: "flex-end", marginRight: 16 }]}><Ionicons name="bookmark" size={14} color={colors.primary} /><Text style={s.savedCount}>{saved.length}</Text></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catsRow}>
        {cats.map(c => {
          const cc = c === 'all' ? colors.primary : (catColor[c] || colors.primary);
          return (
            <TouchableOpacity key={c} style={[s.catBtn, cat === c && { backgroundColor: cc, borderColor: cc }]} onPress={() => setCat(c)}>
              {c !== 'all' && <Ionicons name={catIcon[c] || 'bulb-outline'} size={14} color={cat === c ? '#fff' : tc.textSecondary} />}
              <Text style={[s.catBtnText, cat === c && { color: '#fff', fontWeight: '600' }]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={shown}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <Card item={item} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="bulb-outline" size={48} color={tc.textMuted} />
            <Text style={s.emptyText}>No tips for this category</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, paddingBottom: 0 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: tc.text },
  pageSub: { fontSize: 14, color: tc.textSecondary },
  savedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  savedCount: { fontSize: 13, fontWeight: '600', color: colors.primary },
  catsRow: { paddingHorizontal: spacing.md, paddingVertical: 14, gap: 8 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: tc.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  catBtnText: { fontSize: 13, color: tc.textSecondary },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: tc.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: tc.text, marginBottom: 6 },
  catBadge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  saveBtn: { padding: 2 },
  tipPreview: { fontSize: 13, color: tc.textSecondary, lineHeight: 18 },
  expandedContent: { borderTopWidth: 1, borderTopColor: tc.border, paddingTop: 12, marginTop: 4 },
  tipContent: { fontSize: 14, color: tc.text, lineHeight: 20, marginBottom: 12 },
  tipsList: { gap: 8 },
  tipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  tipItemText: { flex: 1, fontSize: 13, color: tc.textSecondary, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginTop: 12 },
});
