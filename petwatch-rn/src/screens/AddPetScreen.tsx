import AppHeader from '../components/AppHeader';
import { roundedScreenPanel } from '../components/HeaderSurface';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { petsApi } from '../services/api';

const SPECIES = ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'other'];
const EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', bird: '🦜', rabbit: '🐰', hamster: '🐹', other: '🐾' };

export default function AddPetScreen({ navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const { token, needsFirstPet, completeFirstPet } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', species: 'dog', breed: '', age: '', weight: '', color: '' });
  const s = styles(tc, isDark);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const leave = () => {
    if (needsFirstPet) { completeFirstPet(); navigation.navigate('Main'); }
    else navigation.goBack();
  };

  const save = async () => {
    if (saving) return;
    if (!form.name || !form.breed) { Toast.show({ type: 'error', text1: 'Please fill in name and breed' }); return; }
    if (!token) return;
    setSaving(true);
    try {
      await petsApi.create(form, token);
      Toast.show({ type: 'success', text1: `${form.name} has been added!` });
      if (needsFirstPet) completeFirstPet();
      navigation.navigate('Main', { screen: 'Home', params: { refresh: Date.now() } });
    } catch (error: any) { Toast.show({ type: 'error', text1: 'Could not add pet', text2: error.message }); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <AppHeader title={needsFirstPet ? "Add Your First Pet" : "Add New Pet"} onBack={leave} backDisabled={saving} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.panel}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <View style={s.iconSection}><View style={s.petIcon}><Ionicons name="paw" size={40} color={colors.primary} /></View><Text style={s.iconHint}>Tap to add a photo</Text></View>
          <View style={s.card}>
            <Text style={s.sectionTitle}>Basic Information</Text>
            <Text style={s.label}>Pet Name *</Text>
            <TextInput style={s.input} value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Buddy" placeholderTextColor={tc.textMuted} />
            <Text style={s.label}>Species *</Text>
            <View style={s.speciesGrid}>
              {SPECIES.map(sp => (
                <TouchableOpacity key={sp} style={[s.speciesBtn, form.species === sp && s.speciesBtnActive]} onPress={() => set('species', sp)}>
                  <Text style={[s.speciesBtnText, form.species === sp && { color: colors.primary, fontWeight: '600' }]}>{EMOJI[sp]} {sp}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Breed *</Text>
            <TextInput style={s.input} value={form.breed} onChangeText={v => set('breed', v)} placeholder="e.g. Golden Retriever" placeholderTextColor={tc.textMuted} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Text style={s.label}>Age (years)</Text><TextInput style={s.input} value={form.age} onChangeText={v => set('age', v)} keyboardType="numeric" placeholder="3" placeholderTextColor={tc.textMuted} /></View>
              <View style={{ flex: 1 }}><Text style={s.label}>Weight (kg)</Text><TextInput style={s.input} value={form.weight} onChangeText={v => set('weight', v)} keyboardType="numeric" placeholder="30" placeholderTextColor={tc.textMuted} /></View>
            </View>
            <Text style={s.label}>Color</Text>
            <TextInput style={s.input} value={form.color} onChangeText={v => set('color', v)} placeholder="e.g. Golden" placeholderTextColor={tc.textMuted} />
          </View>
          <TouchableOpacity style={s.btn} disabled={saving} onPress={save}>{saving ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="paw" size={18} color={colors.white} /><Text style={s.btnText}>Add Pet</Text></>}</TouchableOpacity>
          <TouchableOpacity disabled={saving} style={{ alignItems: 'center', paddingVertical: 12 }} onPress={leave}><Text style={{ fontSize: 15, color: tc.textSecondary }}>{needsFirstPet ? 'Skip for now' : 'Cancel'}</Text></TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc.background },
  panel: { ...roundedScreenPanel, backgroundColor: tc.background },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '600', color: tc.text },
  container: { padding: spacing.md, paddingBottom: 40 },
  iconSection: { alignItems: 'center', marginBottom: 20 },
  petIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: isDark ? colors.primarySoftDark : colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', marginBottom: 8 },
  iconHint: { fontSize: 13, color: tc.textMuted },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: tc.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tc.text, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: tc.text, backgroundColor: tc.inputBg, marginBottom: 8 },
  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  speciesBtn: { borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  speciesBtnActive: { borderColor: colors.primary, backgroundColor: isDark ? colors.primarySoftDark : colors.primarySoft },
  speciesBtnText: { fontSize: 13, color: tc.textSecondary, textTransform: 'capitalize' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, marginBottom: 10 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
