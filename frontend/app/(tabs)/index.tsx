import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { user, logout, refreshUser } = useAuthStore();
  const router = useRouter();
  const stats = user?.stats;
  const { colors, isDark, toggle } = useTheme();

  useFocusEffect(useCallback(() => { refreshUser(); }, []));

  const styles = makeStyles(colors);

  return (
    <LinearGradient colors={colors.gradient.bg} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0]} 👋</Text>
            <View style={styles.headerActions}>
              {/* Theme toggle */}
              <Pressable onPress={toggle} style={styles.iconBtn}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={20}
                  color={colors.text.secondary}
                />
              </Pressable>
              <Pressable onPress={logout}>
                <Text style={styles.logoutText}>Sign out</Text>
              </Pressable>
            </View>
          </View>

          {/* Stats card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.avgScore ?? 0}%</Text>
                <Text style={styles.statLabel}>Avg Score</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.totalSessions ?? 0}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.bestScore ?? 0}%</Text>
                <Text style={styles.statLabel}>Best Score</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.streak ?? 0}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
            </View>
          </View>

          {/* CTA */}
          <Pressable style={styles.btnWrapper} onPress={() => router.navigate('/(tabs)/upload')}>
            <LinearGradient
              colors={['#6C63FF', '#A855F7', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>Start New Quiz</Text>
            </LinearGradient>
          </Pressable>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    bg:       { flex: 1 },
    safeArea: { flex: 1 },
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
    container: { flex: 1, paddingHorizontal: screenPadding, paddingTop: spacing.md },
    header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2xl'] },
    greeting:  { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    iconBtn:   { padding: spacing.xs },
    logoutText: { fontSize: typography.scale.sm, color: colors.text.muted },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radius.xl,
      borderWidth: 1, borderColor: colors.border.default,
      padding: spacing.xl,
      marginBottom: spacing['2xl'],
    },
    cardTitle: { fontSize: typography.scale.md, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: spacing.lg },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    statItem:  { flex: 1, minWidth: '40%', alignItems: 'center', backgroundColor: colors.bg.raised, borderRadius: radius.md, padding: spacing.lg },
    statValue: { fontSize: typography.scale.xl, fontWeight: typography.weights.bold, color: colors.accent.primary },
    statLabel: { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: spacing.xs },
    btnWrapper: { marginBottom: spacing.xl },
    btn:        { borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' },
    btnText:    { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.semibold },
  });
}
