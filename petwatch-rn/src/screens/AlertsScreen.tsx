import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
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
import { useAuth } from '../context/AuthContext';
import { petSharingApi } from '../services/api';


const GREEN = colors.primary;
type ReadFilter = 'all' | 'unread' | 'read';

export const isDiseaseAlert = (item: OwnerNotification) => /outbreak|disease|epidemic/i.test(item.type);
const typeIcon: Record<string, any> = { outbreak: 'warning-outline', vaccination: 'medical-outline', appointment: 'calendar-outline', symptom: 'pulse-outline', deworming: 'shield-outline' };
const sev = (s: string) => s === 'high' ? { bg: colors.dangerBg, border: colors.dangerBg, text: colors.dangerText, color: colors.danger } : s === 'moderate' ? { bg: colors.warningBg, border: colors.warningBg, text: colors.warningText, color: colors.warning } : { bg: colors.infoBg, border: colors.infoBg, text: colors.info, color: colors.info };

export default function AlertsScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const [deciding, setDeciding] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { colors: tc, isDark } = useTheme();
  const isNotifications = route.name === 'Notifications';
  const { notifications: list, loading, error, refresh, markRead: persistRead } = useOwnerNotifications();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const s = styles(tc, isDark);
  const shown = list.filter(item =>
    (isNotifications ? !isDiseaseAlert(item) : isDiseaseAlert(item)) &&
    (readFilter === 'all' || (readFilter === 'read' ? item.read : !item.read))
  );
  const emptyMessage = readFilter === 'all'
    ? (isNotifications ? 'No clinic updates yet' : 'No disease alerts yet')
    : `No ${readFilter} ${isNotifications ? 'notifications' : 'alerts'}`;

  const markRead = async (id: string) => { try { await persistRead(id); Toast.show({ type: 'success', text1: 'Marked as read' }); } catch (failure: any) { Toast.show({ type: 'error', text1: failure.message || 'Unable to update notification' }); } };
  const decide = async (id: string, action: 'approve' | 'deny' | 'revoke') => {
    if (!token || deciding) return;
    setDeciding(id);
    try { await petSharingApi.decide(id, action, token); await refresh(); Toast.show({ type: 'success', text1: action === 'approve' ? 'History access allowed for 30 minutes' : action === 'deny' ? 'Request declined' : 'Access revoked' }); }
    catch (failure: any) { Toast.show({ type: 'error', text1: failure.message || 'Unable to update access.' }); }
    finally { setDeciding(null); }
  };

  const Card = ({ item }: { item: OwnerNotification }) => {
    const ss = sev(item.severity);
    return (
      <View style={s.card}>
        <View style={s.alertIcon}><Ionicons name={typeIcon[item.type] || 'shield-checkmark-outline'} size={30} color={GREEN} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text style={[s.cardTitle, { color: tc.text, flex: 1 }]}>{item.title}</Text>
            <View style={[s.badge, { backgroundColor: ss.bg }]}><Text style={[s.badgeText, { color: ss.text }]}>{item.severity}</Text></View>
          </View>
          <Text style={[s.cardMsg, { color: tc.textSecondary }]}>{item.message}</Text>
          {item.accessRequestId && <View style={{ marginBottom: 12 }}>
            <Text style={{ color: tc.text, fontWeight: '700', marginBottom: 8 }}>Access: {item.requestStatus}</Text>
            {item.requestStatus === 'pending' && <Text style={{ color: tc.text, marginBottom: 8 }}>Share vaccinations, completed consultations, diagnoses, treatments, and medications with this doctor for 30 minutes.</Text>}
            <View style={{ flexDirection: 'row', gap: 10 }}>{(item.requestStatus === 'pending' ? ['approve','deny'] : item.requestStatus === 'approved' ? ['revoke'] : []).map(action => <TouchableOpacity key={action} disabled={deciding !== null} onPress={() => decide(item.accessRequestId!, action as 'approve' | 'deny' | 'revoke')} style={{ padding: 12, borderRadius: 10, backgroundColor: action === 'approve' ? colors.primary : tc.border, opacity: deciding ? 0.5 : 1 }}><Text style={{ color: action === 'approve' ? colors.white : tc.text, fontWeight: '700' }}>{deciding === item.accessRequestId ? 'Updating...' : action === 'approve' ? 'Allow access' : action === 'deny' ? 'Decline' : 'Revoke access'}</Text></TouchableOpacity>)}</View>
          </View>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.date, { color: tc.textMuted }]}>{format(parseISO(item.date), 'MMM d, yyyy ? h:mm a')}</Text>
            {!item.read && <TouchableOpacity onPress={() => markRead(item.id)} style={s.markBtn}><Ionicons name="checkmark-circle-outline" size={14} color={ss.color} /><Text style={[s.markText, { color: ss.color }]}>Mark read</Text></TouchableOpacity>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <AppHeader title={isNotifications ? 'Notifications' : 'Pet Alerts'} subtitle={isNotifications ? 'Clinic updates, reminders, and access requests.' : 'Disease updates from participating veterinary clinics.'} onBack={() => isNotifications ? navigation.goBack() : navigation.navigate('Home')} />
      <View style={s.contentPanel}>
      <View style={s.tabRow} accessibilityRole="tablist">
        {(['all', 'unread', 'read'] as ReadFilter[]).map(filter => (
          <TouchableOpacity key={filter} accessibilityRole="tab" accessibilityState={{ selected: readFilter === filter }} style={[s.tabBtn, readFilter === filter && s.tabBtnActive]} onPress={() => setReadFilter(filter)}>
            <Text style={[s.tabText, readFilter === filter && s.tabTextActive]}>{filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : 'Read'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <>{Boolean(error) && <Text style={{ color: colors.danger, paddingHorizontal: spacing.md }}>{error}</Text>}<FlatList refreshing={loading} onRefresh={refresh} data={shown} keyExtractor={i => i.id} renderItem={({ item }) => <Card item={item} />} contentContainerStyle={{ padding: 10, paddingBottom: 24 }}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="notifications-outline" size={48} color={tc.textMuted} /><Text style={s.emptyText}>{loading ? 'Loading...' : emptyMessage}</Text></View>} /></>
      </View>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background }, contentPanel: { ...roundedScreenPanel, backgroundColor: isDark ? tc.background : colors.white, paddingTop: 18 }, headerRow: { flexDirection: 'row', alignItems: 'center' }, iconButton: { padding: 10 }, alertIcon: { width: 46, height: 46, borderRadius: 11, backgroundColor: isDark ? tc.surface : colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pageHeader: { paddingBottom: 20 },
  pageTitle: { flex: 1, fontSize: 21, fontWeight: '700', color: colors.white },
  pageSub: { fontSize: 12, color: colors.white, marginHorizontal: 18, marginTop: 2 },
  outlineBtn: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  outlineBtnText: { fontSize: 13, color: tc.text },
  statsRow: { flexDirection: 'row', gap: 10, padding: spacing.md, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: tc.surface, borderRadius: radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: tc.border },
  statVal: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, color: tc.textSecondary, marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: 10, marginTop: 0, backgroundColor: isDark ? tc.surface : colors.primarySoft, borderRadius: radius.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: GREEN },
  tabText: { fontSize: 12, color: tc.textSecondary },
  tabTextActive: { color: colors.white, fontWeight: '700' },
  card: { flexDirection: 'row', borderRadius: 15, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: isDark ? tc.border : colors.border, backgroundColor: tc.surface, minHeight: 82 },
  cardTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  cardMsg: { fontSize: 12, marginBottom: 5, lineHeight: 15 },
  date: { fontSize: 10 },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markText: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: tc.textSecondary, marginTop: 12 },
});
