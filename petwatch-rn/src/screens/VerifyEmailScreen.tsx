import React, { useEffect, useRef, useState } from 'react';
import { colors, gradients } from '../theme/colors';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthBrand from '../components/AuthBrand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerifyEmailScreen({ route, navigation }: any) {
  const email = route.params?.email || '';
  const { verifyEmail } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const initialWait = Number(route.params?.retryAfter ?? (route.params?.emailSent === false ? 0 : 60));
  const resendAt = useRef(Number(route.params?.resendAvailableAt) || Date.now() + initialWait * 1000);
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000)));
  const cooldownKey = `verification-resend:${email.trim().toLowerCase()}`;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(route.params?.emailSent === false ? 'Your account is saved but your email is not verified. If you have no code, tap Resend Code below.' : 'We sent a six-digit code to your email. It expires in 10 minutes.');
  useEffect(() => {
    let active = true;
    resendAt.current = Number(route.params?.resendAvailableAt) || Date.now() + initialWait * 1000;
    const tick = () => { if (active) setRemaining(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000))); };
    AsyncStorage.getItem(cooldownKey).then(saved => {
      if (!active) return;
      const deadline = Number(saved);
      if (Number.isFinite(deadline)) resendAt.current = Math.max(resendAt.current, deadline);
      tick();
      return AsyncStorage.setItem(cooldownKey, String(resendAt.current));
    }).catch(() => { /* Server limits still apply if local storage is unavailable. */ });
    tick();
    const timer = setInterval(tick, 1000);
    return () => { active = false; clearInterval(timer); };
  }, [email]);
  const startCooldown = (seconds: number) => {
    const wait = Math.max(0, Number(seconds) || 60);
    resendAt.current = Date.now() + wait * 1000;
    setRemaining(wait);
    AsyncStorage.setItem(cooldownKey, String(resendAt.current)).catch(() => {});
  };
  const verify = async () => {
    if (busy || resending) return;
    if (!/^\d{6}$/.test(code)) return setError('Enter the six-digit code from your email.');
    setBusy(true); setError('');
    try { await verifyEmail(email, code); }
    catch (failure: any) { setError(failure.message || 'Could not verify your email.'); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    if (remaining || busy || resending) return;
    setResending(true); setError('');
    try {
      const result = await authApi.resendVerification(email);
      startCooldown(result.retry_after || 60);
      setNotice('A new six-digit code has been sent. It expires in 10 minutes. Use the newest code.'); setCode('');
    } catch (failure: any) {
      if (failure.retryAfter) startCooldown(failure.retryAfter);
      setError(failure.message || 'Could not send a new code.');
    }
    finally { setResending(false); }
  };
  return <LinearGradient colors={gradients.header} style={{ flex: 1 }}><SafeAreaView style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
    <AuthBrand />
    <View style={s.card}><View style={s.icon}><Ionicons name="mail-open-outline" size={32} color={colors.primary} /></View>
      <Text accessibilityRole="header" style={s.title}>Verify your email</Text><Text style={s.body}>{notice}</Text><Text style={s.email}>{email}</Text>
      <Text style={s.label}>Verification code</Text>
      <TextInput accessibilityLabel="Verification code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6}
        autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" style={s.input} editable={!busy && !resending} />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Verify Email" onPress={verify} disabled={busy || resending} style={s.button}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.buttonText}>Verify Email</Text>}</TouchableOpacity>
      <View style={s.deliveryHelp}>
        <Text style={s.helpTitle}>Didn’t receive a code?</Text>
        <Text style={s.hint}>Check your spam or junk folder, or request a new code.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Resend Code" accessibilityState={{ disabled: !!remaining || busy || resending }}
          disabled={!!remaining || busy || resending} onPress={resend} style={[s.resendButton, (!!remaining || busy || resending) && s.resendDisabled]}>
          {resending ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.link}>{remaining ? `Resend Code in ${remaining}s` : 'Resend Code'}</Text>}
        </TouchableOpacity>
      </View>
      <Text style={s.hint}>Your account stays pending until your email is verified.</Text>
      <TouchableOpacity disabled={busy || resending} onPress={() => navigation.navigate('Login')} style={s.resend}><Text style={s.link}>Back to Sign In</Text></TouchableOpacity>
    </View>
  </ScrollView></SafeAreaView></LinearGradient>;
}
const s = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, logo: { width: 218, height: 133, marginBottom: 24 },
  card: { width: '100%', maxWidth: 430, backgroundColor: colors.white, padding: 24, borderRadius: 20, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  icon: { alignSelf: 'center', backgroundColor: colors.primarySoft, padding: 15, borderRadius: 40, marginBottom: 16 }, title: { fontSize: 25, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 12 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' }, email: { textAlign: 'center', color: colors.primary, fontWeight: '600', marginVertical: 15 }, label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text },
  input: { height: 54, backgroundColor: colors.light.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, textAlign: 'center', fontSize: 25, letterSpacing: 9, color: colors.ink, marginBottom: 16 },
  button: { minHeight: 46, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' }, resend: { alignItems: 'center', padding: 13 }, link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, error: { color: colors.dangerText, fontSize: 13, marginBottom: 14, lineHeight: 19 },
  deliveryHelp: { marginTop: 22, marginBottom: 16, alignItems: 'center', gap: 7 }, helpTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  resendButton: { minHeight: 44, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  resendDisabled: { opacity: 0.5, backgroundColor: colors.hoverRow },
});
