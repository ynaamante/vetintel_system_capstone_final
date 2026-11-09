import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, spacing, radius } from '../theme/colors';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const s = styles(tc, isDark);

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
        <ScrollView 
          contentContainerStyle={s.container} 
          keyboardShouldPersistTaps="always"
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.brand}>
            <View style={s.logo}><Ionicons name="heart" size={36} color="#fff" /></View>
            <Text style={s.appName}>PetWatch</Text>
            <Text style={s.tagline}>Monitor your pet's health with care</Text>
          </View>
          <View style={s.card}>
            <Text style={s.title}>Welcome Back</Text>
            <Text style={s.sub}>Sign in to access your pet's health records</Text>
            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <Ionicons name="mail-outline" size={18} color={tc.textMuted} style={s.icon} />
              <TextInput 
                style={s.input} 
                placeholder="your@email.com" 
                placeholderTextColor={tc.textMuted} 
                value={email} 
                onChangeText={setEmail} 
                keyboardType="email-address" 
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={tc.textMuted} style={s.icon} />
              <TextInput 
                style={[s.input, { flex: 1 }]} 
                placeholder="••••••••" 
                placeholderTextColor={tc.textMuted} 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry={!showPwd}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{ paddingHorizontal: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={tc.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Text style={s.btnText}>Sign In</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
            </TouchableOpacity>
            <View style={s.row}>
              <Text style={s.muted}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}><Text style={s.link}>Sign up</Text></TouchableOpacity>
            </View>
          </View>
          <View style={s.demo}>
            <Text style={s.demoTitle}>Demo Account</Text>
            <Text style={s.demoText}>Enter any email and password to try the app</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (tc: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: isDark ? colors.deepSpace : '#EFF6FF' },
  container: { flexGrow: 1, padding: spacing.md, justifyContent: 'center', paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  appName: { fontSize: 28, fontWeight: '700', color: tc.text, marginBottom: 4 },
  tagline: { fontSize: 14, color: tc.textSecondary },
  card: { backgroundColor: tc.surface, borderRadius: radius.lg, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 20, fontWeight: '700', color: tc.text, marginBottom: 4 },
  sub: { fontSize: 13, color: tc.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: tc.text, marginBottom: 6, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: tc.border, borderRadius: radius.md, backgroundColor: tc.inputBg, paddingHorizontal: 12, marginBottom: 14 },
  icon: { marginRight: 8 },
  input: { flex: 1, height: 44, fontSize: 15, color: tc.text },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, marginBottom: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  muted: { fontSize: 14, color: tc.textSecondary },
  link: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  demo: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: radius.md, padding: 16 },
  demoTitle: { fontSize: 14, fontWeight: '600', color: '#1E40AF', marginBottom: 4 },
  demoText: { fontSize: 13, color: '#087A70' },
});
