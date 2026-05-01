import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

function QuizlyLogo() {
  return (
    <View style={logoStyles.wrap}>
      <Image source={require('../../assets/icon.png')} style={logoStyles.icon} />
      <Text style={logoStyles.wordmark}>Quizly</Text>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon:     { width: 52, height: 52, borderRadius: 14 },
  wordmark: { fontSize: 34, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
});

export default function RegisterScreen() {
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const register = useAuthStore((s) => s.register);
  const { colors } = useTheme();

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    try {
      setLoading(true);
      await register(name.trim(), email.trim(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Registration failed. Please try again.';
      Alert.alert('Registration failed', msg);
    } finally {
      setLoading(false);
    }
  }

  const styles = makeStyles(colors);

  return (
    <LinearGradient colors={colors.gradient.bg} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

            {/* Branded header */}
            <View style={styles.header}>
              <QuizlyLogo />
              <Text style={styles.tagline}>Turn documents into knowledge</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Start your learning journey</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputFlex}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="min. 8 characters"
                    placeholderTextColor={colors.text.muted}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                    <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={handleRegister} disabled={loading} style={styles.btnWrapper}>
                <LinearGradient
                  colors={['#6C63FF', '#A855F7', '#EC4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.btn}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Create Account</Text>
                  }
                </LinearGradient>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/(auth)/login">
                  <Text style={styles.link}>Sign in</Text>
                </Link>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    bg:  { flex: 1 },
    orb1: {
      position: 'absolute', top: -100, right: -80,
      width: 300, height: 300, borderRadius: 150,
      backgroundColor: 'rgba(108, 99, 255, 0.12)',
    },
    orb2: {
      position: 'absolute', bottom: 50, left: -100,
      width: 250, height: 250, borderRadius: 125,
      backgroundColor: 'rgba(168, 85, 247, 0.08)',
    },
    container:  { flexGrow: 1, justifyContent: 'center', paddingHorizontal: screenPadding, paddingVertical: spacing['3xl'] },
    header:     { alignItems: 'center', marginBottom: spacing['3xl'] },
    tagline:    { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: spacing.sm },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radius.xl,
      borderWidth: 1, borderColor: colors.border.default,
      padding: spacing['2xl'],
    },
    title:    { fontSize: typography.scale.xl, fontWeight: typography.weights.bold, color: colors.text.primary, marginBottom: spacing.xs },
    subtitle: { fontSize: typography.scale.sm, color: colors.text.secondary, marginBottom: spacing['2xl'] },
    field:    { marginBottom: spacing.lg },
    label:    { fontSize: typography.scale.sm, color: colors.text.secondary, marginBottom: spacing.xs, fontWeight: typography.weights.medium },
    input: {
      backgroundColor: colors.bg.raised,
      borderWidth: 1, borderColor: colors.border.default,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      color: colors.text.primary, fontSize: typography.scale.base,
    },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.bg.raised,
      borderWidth: 1, borderColor: colors.border.default,
      borderRadius: radius.md,
    },
    inputFlex: {
      flex: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      color: colors.text.primary, fontSize: typography.scale.base,
    },
    eyeBtn:     { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
    eyeText:    { color: colors.accent.primary, fontSize: typography.scale.sm, fontWeight: typography.weights.medium },
    btnWrapper: { marginTop: spacing.md },
    btn:        { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    btnText:    { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.semibold },
    footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
    footerText: { color: colors.text.secondary, fontSize: typography.scale.sm },
    link:       { color: colors.accent.primary, fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },
  });
}
