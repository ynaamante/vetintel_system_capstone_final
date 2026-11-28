import React from 'react';
import { colors } from '../theme/colors';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';

type Props = { visible: boolean; title: string; subject?: string; description: string; confirmLabel: string; busy?: boolean; error?: string; onConfirm: () => void; onCancel: () => void };
export default function ArchiveDialog({ visible, title, subject, description, confirmLabel, busy, error, onConfirm, onCancel }: Props) {
  const [boldFontLoaded] = useFonts({ VetIntelInboxBold: require('../assets/fonts/Lato-Bold.ttf') });
  const { width } = useWindowDimensions();
  const s = styles(Math.min((width - 32) / 895, 0.65), boldFontLoaded);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={s.archiveBackdrop}><ScrollView contentContainerStyle={s.archiveScroll} bounces={false}><View style={s.archiveDialog} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={s.archiveTitle}>{title}</Text>
      <View style={s.archiveClinicBox}><Text style={s.archiveClinic}>{subject}</Text></View>
      <Text style={s.archiveDescription}>{description}</Text>
      {!!error && <Text style={s.archiveError}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[s.archiveConfirm, { opacity: busy ? 0.6 : 1 }]}><Text style={s.archiveConfirmText}>{busy ? 'Saving...' : confirmLabel}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onCancel} style={s.archiveCancel}><Text style={s.archiveCancelText}>Cancel</Text></TouchableOpacity>
    </View></ScrollView></View>
  </Modal>;
}
const styles = (dialogScale: number, boldFontLoaded: boolean) => StyleSheet.create({
  archiveBackdrop: { flex: 1, backgroundColor: colors.overlay, paddingHorizontal: 16 },
  archiveScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  archiveDialog: { width: '100%', maxWidth: 582, alignSelf: 'center', backgroundColor: colors.white, borderRadius: 34 * dialogScale, paddingHorizontal: 40 * dialogScale, paddingTop: 42 * dialogScale, paddingBottom: 48 * dialogScale },
  archiveTitle: { color: colors.ink, fontSize: 62 * dialogScale, lineHeight: 76 * dialogScale, fontFamily: boldFontLoaded ? 'VetIntelInboxBold' : undefined, fontWeight: boldFontLoaded ? 'normal' : '700', letterSpacing: -1.2 * dialogScale, marginHorizontal: 9 * dialogScale, marginBottom: 25 * dialogScale },
  archiveClinicBox: { backgroundColor: colors.primarySoft, borderRadius: 21 * dialogScale, paddingHorizontal: 27 * dialogScale, paddingVertical: 12 * dialogScale, marginHorizontal: 6 * dialogScale, marginBottom: 24 * dialogScale },
  archiveClinic: { color: colors.ink, fontSize: 42 * dialogScale, lineHeight: 51 * dialogScale, fontFamily: boldFontLoaded ? 'VetIntelInboxBold' : undefined, fontWeight: boldFontLoaded ? 'normal' : '700' },
  archiveDescription: { color: colors.text, fontSize: 34 * dialogScale, lineHeight: 43 * dialogScale, marginHorizontal: 10 * dialogScale, marginBottom: 52 * dialogScale },
  archiveError: { color: colors.dangerText, fontSize: 14, marginBottom: 12 },
  archiveConfirm: { minHeight: Math.max(44, 88 * dialogScale), backgroundColor: colors.primary, borderRadius: 24 * dialogScale, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 * dialogScale, marginBottom: 23 * dialogScale },
  archiveConfirmText: { color: colors.white, fontSize: 39 * dialogScale, lineHeight: 48 * dialogScale, fontFamily: boldFontLoaded ? 'VetIntelInboxBold' : undefined, fontWeight: boldFontLoaded ? 'normal' : '700', textAlign: 'center' },
  archiveCancel: { minHeight: Math.max(44, 88 * dialogScale), borderWidth: Math.max(1.5, 3 * dialogScale), borderColor: colors.primary, borderRadius: 24 * dialogScale, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14 * dialogScale },
  archiveCancelText: { color: colors.ink, fontSize: 39 * dialogScale, lineHeight: 48 * dialogScale, fontFamily: boldFontLoaded ? 'VetIntelInboxBold' : undefined, fontWeight: boldFontLoaded ? 'normal' : '700', textAlign: 'center' },
});
