import React, { useEffect, useState } from 'react';
import { colors, gradients } from '../theme/colors';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import AuthBrand from '../components/AuthBrand';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ForgotPasswordScreen({ route, navigation }: any) {
  const { colors: tc, isDark } = useTheme();
  const { clearError } = useAuth();
  const [email, setEmail] = useState(route.params?.email || '');
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const send = async () => {
    if (busy || remaining > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your account email.'); return; }
    setBusy(true); setError('');
    try {
      const result = await authApi.forgotPassword(email);
      setEmail(email.trim().toLowerCase()); setStep('code'); setCode(''); setPassword(''); setConfirm('');
      setDeadline(Date.now() + (result.retry_after || 60) * 1000);
    } catch (failure: any) { setError(failure.message || 'Unable to request a code. Please try again.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit reset code.'); return; }
    setBusy(true); setError('');
    try { await authApi.verifyResetCode(email, code); setStep('password'); }
    catch (failure: any) { setError(failure.message || 'Unable to verify the code.'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (busy) return;
    if (password.length < 8 || password.length > 72) { setError('Use a password with 8 to 72 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await authApi.resetPassword(email, code, password); clearError();
      Toast.show({ type: 'success', text1: 'Password updated', text2: 'Sign in with your new password.' });
      navigation.replace('Login', { email });
    } catch (failure: any) { setError(failure.message || 'Unable to reset your password.'); }
    finally { setBusy(false); }
  };
  const s = StyleSheet.create({
    safe: { flex: 1 }, container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 30, alignItems: 'center' },
    card: { width: '100%', maxWidth: 420, padding: 18, paddingBottom: 25, borderRadius: 20, backgroundColor: tc.surface, borderWidth: 1, borderColor: isDark ? tc.border : colors.border },
    title: { fontSize: 25, fontWeight: '800', color: tc.text, marginBottom: 6 },
    body: { fontSize: 13, lineHeight: 19, color: tc.text, marginBottom: 18 },
    label: { fontSize: 14, fontWeight: '700', color: isDark ? tc.text : colors.ink, marginBottom: 7 },
    input: { flex: 1, fontSize: 15, color: tc.text, paddingHorizontal: 13, paddingVertical: 11, minHeight: 42 },
    field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDark ? tc.border : colors.inputBorder, borderRadius: 11, backgroundColor: tc.inputBg, marginBottom: 17 },
    eye: { padding: 11 }, button: { minHeight: 47, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: colors.primary },
    buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' }, link: { color: isDark ? tc.text : colors.primary, fontWeight: '600', fontSize: 14 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginBottom: 14 },
    decoration: { position: 'absolute', width: 380, height: 150, borderRadius: 190, backgroundColor: colors.primarySoft, opacity: isDark ? 0.03 : 0.35 },
  });
  return <LinearGradient colors={isDark ? [tc.background, tc.surface] : gradients.header} style={{ flex: 1 }}>
    <View pointerEvents="none" style={[s.decoration, { top: -100, left: -100, transform: [{ rotate: '-20deg' }] }]} />
    <View pointerEvents="none" style={[s.decoration, { bottom: -85, right: -65, transform: [{ rotate: '-12deg' }] }]} />
    <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
        <AuthBrand />
        <View style={s.card}>
          <TouchableOpacity accessibilityLabel="Back" disabled={busy} onPress={() => {
            setError('');
            if (step === 'password') { setStep('code'); setPassword(''); setConfirm(''); }
            else if (step === 'code') setStep('email');
            else navigation.goBack();
          }} style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 15, marginBottom: 13 }}>
            <Ionicons name="arrow-back" size={23} color={isDark ? tc.text : colors.ink} />
          </TouchableOpacity>
          <Text style={s.title}>{step === 'email' ? 'Forgot Password' : 'Reset Password'}</Text>
          <Text style={s.body}>{step === 'email' ? 'Enter your pet-owner account email to request a password reset code.' : step === 'code' ? `If ${email} belongs to a pet-owner account, a code will arrive by email. It expires in 10 minutes.` : 'Code verified. Enter and confirm your new password below.'}</Text>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          {step === 'email' && <><Text style={s.label}>Email</Text><View style={s.field}><TextInput accessibilityLabel="Account email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} placeholder="your@email.com" placeholderTextColor={tc.textMuted} style={s.input} /></View></>}
          {step === 'code' && <><Text style={s.label}>Reset code</Text><View style={s.field}><TextInput accessibilityLabel="Six-digit reset code" keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))} editable={!busy} placeholder="000000" placeholderTextColor={tc.textMuted} style={s.input} onSubmitEditing={verify} /></View></>}
          {step === 'password' && <>
            <Text style={s.label}>New password</Text><View style={s.field}><TextInput accessibilityLabel="New password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" placeholder="At least 8 characters" placeholderTextColor={tc.textMuted} style={s.input} /><TouchableOpacity style={s.eye} accessibilityLabel={showPassword ? 'Hide new password' : 'Show new password'} onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={isDark ? tc.text : colors.primary} /></TouchableOpacity></View>
            <Text style={s.label}>Confirm new password</Text><View style={s.field}><TextInput accessibilityLabel="Confirm new password" value={confirm} onChangeText={setConfirm} editable={!busy} secureTextEntry={!showConfirm} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" placeholder="Re-enter new password" placeholderTextColor={tc.textMuted} style={s.input} onSubmitEditing={reset} /><TouchableOpacity style={s.eye} accessibilityLabel={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'} onPress={() => setShowConfirm(!showConfirm)}><Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={21} color={isDark ? tc.text : colors.primary} /></TouchableOpacity></View>
          </>}
          <TouchableOpacity disabled={busy || (step === 'email' && remaining > 0)} onPress={step === 'email' ? send : step === 'code' ? verify : reset} style={[s.button, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.buttonText}>{step === 'email' ? remaining > 0 ? `Send code in ${remaining}s` : 'Send Reset Code' : step === 'code' ? 'Verify Code' : 'Reset Password'}</Text>}</TouchableOpacity>
          {step === 'code' && <TouchableOpacity disabled={busy || remaining > 0} onPress={send} style={{ alignItems: 'center', paddingTop: 18, opacity: remaining > 0 ? 0.6 : 1 }}><Text style={s.link}>{remaining > 0 ? `Resend Code in ${remaining}s` : 'Resend Code'}</Text></TouchableOpacity>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </LinearGradient>;
}
