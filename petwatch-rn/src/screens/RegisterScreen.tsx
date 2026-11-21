import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import AuthBrand from '../components/AuthBrand';

// Summaries of the policies already published on the VetIntel landing page.
const policies = {
  terms: { title: 'Terms of Service', text: 'By accessing or using VetIntel, users agree to comply with its Terms of Service.\n\nPet owners are responsible for providing accurate information and maintaining the security of their accounts.\n\nVetIntel provides technology and data-management services and does not replace professional veterinary judgment.\n\nAppropriately anonymized and aggregated health indicators may be used for disease monitoring, analytics, and veterinary intelligence.\n\nUsers must not attempt to access unauthorized information, interfere with the platform, misuse another user’s account, or compromise system security.\n\nVetIntel aims to maintain reliable services but cannot guarantee uninterrupted availability. Features, policies, and services may be updated when necessary.' },
  privacy: { title: 'Privacy Policy', text: 'VetIntel collects account, clinic, pet, appointment, medical and health, communication, and system activity information.\n\nThis information supports veterinary care, clinic operations, and platform services.\n\nVetIntel separates private clinic records from shared veterinary intelligence. Personally identifiable owner information is not shared as part of the intelligence layer.' },
};
function Field({ label, optional, value, onChangeText, icon, placeholder, secure, loading, keyboard, styles: s }: any) {
  const [visible, setVisible] = useState(false);
  return <View style={s.field}>
    <Text style={s.label}>{label}{optional ? <Text style={s.optional}> (Optional)</Text> : <Text style={s.required}> *</Text>}</Text>
    <View style={s.inputRow}>
      <Ionicons name={icon} size={18} color="#79958c" />
      <TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#7c8580"
        autoCapitalize={label === 'Full Name' ? 'words' : 'none'} keyboardType={keyboard || 'default'} secureTextEntry={secure && !visible} editable={!loading}
        autoComplete={secure ? 'new-password' : label === 'Email' ? 'email' : label === 'Full Name' ? 'name' : 'tel'} />
      {secure && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        onPress={() => setVisible(current => !current)} style={s.eye}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={19} color="#718d82" /></TouchableOpacity>}
    </View>
  </View>;
}
export default function RegisterScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(null);
  const s = styles(isDark);
  const handleRegister = async () => {
    if (loading) return;
    setError('');
    if (!name.trim() || !email.trim() || !password) return setError('Please fill in all required fields.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (password.length < 8 || password.length > 72) return setError('Use a password with 8–72 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!accepted) return setError('Please agree to the Terms of Service and Privacy Policy.');
    setLoading(true);
    try {
      const result = await authApi.register(name, email, password, { phone: phone.trim(), accepted_terms: accepted });
      navigation.navigate('VerifyEmail', { email: result.email || email.trim().toLowerCase(), emailSent: result.email_sent,
        retryAfter: result.retry_after || 0, resendAvailableAt: Date.now() + (result.retry_after || 0) * 1000 });
    } catch (failure: any) { setError(failure.message || 'Could not create your account. Please try again.'); }
    finally { setLoading(false); }
  };
  return <LinearGradient colors={isDark ? ['#112a23', '#172e27'] : ['#e6f3ec', '#dfeee7']} style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1 }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AuthBrand />
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.title}>Create Account</Text><Text style={s.subtitle}>Join to manage your pet’s health records.</Text>
          <Field label="Full Name" value={name} onChangeText={setName} icon="person-outline" placeholder="Enter your full name" loading={loading} styles={s} />
          <Field label="Email" value={email} onChangeText={setEmail} icon="mail-outline" placeholder="your@email.com" keyboard="email-address" loading={loading} styles={s} />
          <Text style={[s.subtitle, { marginTop: -6, marginBottom: 14, textAlign: 'left' }]}>Use the same email you gave your veterinary clinic. After verification, your clinic-registered pets and their medical records will appear automatically.</Text>
          <Field label="Phone Number" optional value={phone} onChangeText={setPhone} icon="call-outline" placeholder="09XX XXX XXXX" keyboard="phone-pad" loading={loading} styles={s} />
          <Field label="Password" value={password} onChangeText={setPassword} icon="lock-closed-outline" placeholder="At least 8 characters" secure loading={loading} styles={s} />
          <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} icon="lock-closed-outline" placeholder="Re-enter your password" secure loading={loading} styles={s} />
          <View style={s.consent}>
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: accepted, disabled: loading }} accessibilityLabel="Agree to Terms of Service and Privacy Policy"
              disabled={loading} onPress={() => { setAccepted(value => !value); setError(''); }} style={s.checkbox}><Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={23} color="#087b59" /></TouchableOpacity>
            <Text style={s.consentText}>By creating an account, you agree to the{'\n'}<Text accessibilityRole="link" style={s.link} onPress={() => setPolicy('terms')}>Terms of Service</Text> and{' '}<Text accessibilityRole="link" style={s.link} onPress={() => setPolicy('privacy')}>Privacy Policy.</Text></Text>
          </View>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create Account" disabled={loading} onPress={handleRegister} style={s.button}>
            <LinearGradient colors={['#007968', '#0b984e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.buttonFill}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Create Account</Text>}</LinearGradient>
          </TouchableOpacity>
          <Text style={s.footer}>Already have an account? <Text style={s.link} accessibilityRole="link" onPress={() => !loading && navigation.navigate('Login')}>Sign In</Text></Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={!!policy} transparent animationType="fade" onRequestClose={() => setPolicy(null)}><View style={s.overlay}><View style={s.policyCard}>
      <Text accessibilityRole="header" style={s.title}>{policy ? policies[policy].title : ''}</Text><ScrollView><Text style={s.policyText}>{policy ? policies[policy].text : ''}</Text></ScrollView>
      <TouchableOpacity accessibilityRole="button" onPress={() => setPolicy(null)} style={s.close}><Text style={s.link}>Close</Text></TouchableOpacity>
    </View></View></Modal>
    </SafeAreaView>
  </LinearGradient>;
}
const styles = (dark: boolean) => StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingTop: 20, paddingBottom: 32 }, logo: { width: 218, height: 133, marginBottom: 19 },
  card: { width: '100%', maxWidth: 430, backgroundColor: dark ? '#203c31' : '#fff', padding: 22, borderRadius: 20, shadowColor: '#315849', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 5 },
  title: { color: dark ? '#f1f7f3' : '#242629', fontSize: 26, fontWeight: '800', marginBottom: 4 }, subtitle: { color: dark ? '#b8d0c5' : '#648377', fontSize: 14, marginBottom: 20 },
  field: { marginBottom: 10 }, label: { color: dark ? '#edf4f0' : '#242629', fontSize: 14, fontWeight: '600', marginBottom: 5 }, required: { color: '#d52432' }, optional: { fontWeight: '400' },
  inputRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderColor: dark ? '#4c685c' : '#cddfd5', borderWidth: 1, borderRadius: 8, backgroundColor: dark ? '#193328' : '#f4f7f2' },
  input: { flex: 1, minWidth: 0, height: 37, paddingHorizontal: 8, fontSize: 14, color: dark ? '#f4f8f5' : '#29372f' }, eye: { padding: 6 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 3, marginBottom: 17 }, checkbox: { padding: 4, marginLeft: -3, marginRight: 8 }, consentText: { flex: 1, fontSize: 12, lineHeight: 17, paddingTop: 4, color: dark ? '#d9e7df' : '#424b46' },
  link: { color: dark ? '#6bdfb8' : '#007957', fontWeight: '700' }, button: { borderRadius: 8, overflow: 'hidden' }, buttonFill: { minHeight: 46, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 20, color: dark ? '#b8d0c5' : '#69877c' }, error: { color: dark ? '#ffbab4' : '#b42318', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#001c1599' }, policyCard: { width: '100%', maxWidth: 480, maxHeight: '80%', backgroundColor: dark ? '#203c31' : '#fff', padding: 24, borderRadius: 18 }, policyText: { color: dark ? '#d9e7df' : '#424b46', fontSize: 14, lineHeight: 22, marginVertical: 16 }, close: { alignSelf: 'flex-end', padding: 12 },
});
