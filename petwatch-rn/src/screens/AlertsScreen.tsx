import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useOwnerNotifications } from '../context/OwnerNotificationsContext';
import type { OwnerNotification } from '../services/api';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';


type Tab = 'all' | 'unread' | 'read';
const typeIcon: Record<string, any> = { outbreak: 'warning-outline', vaccination: 'medical-outline', appointment: 'calendar-outline', symptom: 'pulse-outline', deworming: 'shield-outline' };
const sev = (s: string) => s === 'high' ? { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', color: colors.danger } : s === 'moderate' ? { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', color: colors.warning } : { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', color: colors.primary };

export default function AlertsScreen() {
  const { colors: tc, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('all');
  const { notifications: list, loading, error, refresh, markRead: persistRead, markAllRead: persistAll } = useOwnerNotifications();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const s = styles(tc, isDark);
  const unread = list.filter(a => !a.read);
  const read = list.filter(a => a.read);
  const shown = tab === 'unread' ? unread : tab === 'read' ? read : list;

  const markRead = async (id: string) => { try { await persistRead(id); Toast.show({ type: 'success', text1: 'Marked as read' }); } catch (failure: any) { Toast.show({ type: 'error', text1: failure.message || 'Unable to update notification' }); } };
  const markAll = async () => { try { await persistAll(); Toast.show({ type: 'success', text1: 'All marked as read' }); } catch (failure: any) { Toast.show({ type: 'error', text1: failure.message || 'Unable to update notifications' }); } };

  const Card = ({ item }: { item: OwnerNotification }) => {
    const ss = sev(item.severity);
    return (
      <View style={[s.card, { backgroundColor: ss.bg, borderColor: ss.border }, !item.read && { borderWidth: 2 }]}>
        <Ionicons name={typeIcon[item.type] || 'notifications-outline'} size={20} color={ss.color} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text style={[s.cardTitle, { color: ss.text, flex: 1 }]}>{item.title}</Text>
            <View style={[s.badge, { backgroundColor: ss.color }]}><Text style={s.badgeText}>{item.severity}</Text></View>
          </View>
          <Text style={[s.cardMsg, { color: ss.text }]}>{item.message}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.date, { color: ss.text, opacity: 0.7 }]}>{format(parseISO(item.date), 'MMM dd, yyyy')}</Text>
            {!item.read && <TouchableOpacity onPress={() => markRead(item.id)} style={s.markBtn}><Ionicons name="checkmark-circle-outline" size={14} color={ss.color} /><Text style={[s.markText, { color: ss.color }]}>Mark read</Text></TouchableOpacity>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.pageHeader}>
        <View><Text style={s.pageTitle}>Alerts</Text><Text style={s.pageSub}>Stay updated on your pet's health</Text></View>
        {unread.length > 0 && <TouchableOpacity style={s.outlineBtn} onPress={markAll}><Text style={s.outlineBtnText}>Mark all read</Text></TouchableOpacity>}
      </View>
      <View style={s.statsRow}>
        {[{ val: list.length, label: 'Total', c: colors.primary }, { val: unread.length, label: 'Unread', c: colors.warning }, { val: list.filter(a => a.severity === 'high').length, label: 'High', c: colors.danger }].map(st => (
          <View key={st.label} style={s.statCard}><Text style={[s.statVal, { color: st.c }]}>{st.val}</Text><Text style={s.statLabel}>{st.label}</Text></View>
        ))}
      </View>
      <View style={s.tabRow}>
        {(['all', 'unread', 'read'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}{t === 'unread' && unread.length > 0 ? ` (${unread.length})` : ''}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <>{Boolean(error) && <Text style={{ color: colors.danger, paddingHorizontal: spacing.md }}>{error}</Text>}<FlatList refreshing={loading} onRefresh={refresh} data={shown} keyExtractor={i => i.id} renderItem={({ item }) => <Card item={item} />} contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="notifications-outline" size={48} color={tc.textMuted} /><Text style={s.emptyText}>{loading ? 'Loading reminders...' : 'No clinic reminders yet'}</Text></View>} /></>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, paddingBottom: 0 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: tc.text },
  pageSub: { fontSize: 14, color: tc.textSecondary },
  outlineBtn: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  outlineBtnText: { fontSize: 13, color: tc.text },
  statsRow: { flexDirection: 'row', gap: 10, padding: spacing.md, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: tc.surface, borderRadius: radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: tc.border },
  statVal: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, color: tc.textSecondary, marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: 14, backgroundColor: tc.border, borderRadius: radius.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: tc.surface },
  tabText: { fontSize: 14, color: tc.textSecondary },
  tabTextActive: { color: tc.text, fontWeight: '600' },
  card: { flexDirection: 'row', borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardMsg: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  date: { fontSize: 12 },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markText: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginTop: 12 },
});
