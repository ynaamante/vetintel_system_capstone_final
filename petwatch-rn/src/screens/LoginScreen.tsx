import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';

export default function LoginScreen({ navigation, route }: any) {
  const { login, error: sessionError } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const [email, setEmail] = useState(route?.params?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const { height } = useWindowDimensions();
  const s = styles(tc, isDark, height < 700 || focusedField !== null);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Please enter email and password',
      });
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      Toast.show({ type: 'success', text1: 'Welcome back!' });
    } catch (err: any) {
      if (err.code === 'EMAIL_VERIFICATION_REQUIRED') {
        navigation.navigate('VerifyEmail', { email: err.email || email.trim(), emailSent: false, retryAfter: 0 });
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: err.message || 'Please check your credentials',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.container}>
          {!focusedField && <View style={s.brand} accessible accessibilityLabel="Vetintel logo">
            <Image source={require('../images/LogoMark.png')} style={s.logoMark} resizeMode="contain" />
            <View style={s.wordmarkCrop}>
              <Image source={require('../images/LogoWordmarkTagline.png')} style={s.wordmark} resizeMode="contain" />
            </View>
            <Text style={s.tagline}>Better Care. Healthier Pets.</Text>
          </View>}
          <View style={s.card}>
            <Text style={s.title}>Welcome Back</Text>
            <Text style={s.sub}>Sign in to access your pet health records.</Text>
            {!!sessionError && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>{sessionError}</Text>}
            <Text style={s.label}>Email</Text>
            <View style={[s.inputRow, focusedField === 'email' && s.inputRowFocused]}>
              <Ionicons name="mail-outline" size={18} color={tc.textMuted} style={s.icon} />
              <TextInput 
                style={s.input} 
                placeholder="your@email.com" 
                placeholderTextColor={tc.textMuted} 
                value={email} 
                onChangeText={setEmail} 
                keyboardType="email-address" 
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(current => current === 'email' ? null : current)}
                editable={!loading}
              />
            </View>
            <Text style={s.label}>Password</Text>
            <View style={[s.inputRow, focusedField === 'password' && s.inputRowFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color={tc.textMuted} style={s.icon} />
              <TextInput 
                style={[s.input, { flex: 1 }]} 
                placeholder="••••••••" 
                placeholderTextColor={tc.textMuted} 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry={!showPwd}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(current => current === 'password' ? null : current)}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{ paddingHorizontal: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={tc.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity disabled={loading} onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })} style={{ alignSelf: 'flex-end', paddingVertical: 10, marginTop: -4, marginBottom: 8 }}><Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Forgot password?</Text></TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
              <View style={s.btnFill}>
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Sign In</Text>}
              </View>
            </TouchableOpacity>
            <View style={s.row}>
              <Text style={s.muted}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}><Text style={s.link}>Sign up</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean, compact: boolean) => StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: isDark ? colors.dark.background : colors.paleSage },
  container: { flex: 1, paddingHorizontal: spacing.md, justifyContent: 'center', paddingVertical: compact ? 12 : 28 },
  brand: { alignItems: 'center', marginBottom: compact ? 12 : 24 },
  logoMark: { width: compact ? 82 : 108, height: compact ? 62 : 86 },
  wordmarkCrop: { width: 170, height: 40, overflow: 'hidden', marginTop: 1 },
  wordmark: { width: 170, height: 52 },
  tagline: { fontSize: 14, color: tc.textSecondary, marginTop: 1 },
  card: { backgroundColor: tc.surface, borderRadius: radius.xl, padding: compact ? 18 : 24, marginBottom: compact ? 0 : 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  title: { fontSize: 24, fontWeight: '700', color: tc.text, marginBottom: 4 },
  sub: { fontSize: 14, color: tc.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDark ? tc.border : colors.inputBorder, borderRadius: radius.md, backgroundColor: tc.inputBg, paddingHorizontal: 12, marginBottom: 14 },
  icon: { marginRight: 8 },
  inputRowFocused: { borderColor: colors.botanicalTeal },
  input: { flex: 1, height: 44, fontSize: 15, color: tc.text, outlineWidth: 0 },
  btn: { borderRadius: radius.md, overflow: 'hidden', height: 48, marginTop: 4, marginBottom: 16 },
  btnFill: { backgroundColor: colors.primary, flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  muted: { fontSize: 14, color: tc.textSecondary },
  link: { fontSize: 14, color: isDark ? colors.chart2 : colors.primary, fontWeight: '600' },
});
