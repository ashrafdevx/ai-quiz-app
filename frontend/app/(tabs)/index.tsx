import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../constants/colors';
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
  const insets = useSafeAreaInsets();
  const stats = user?.stats;

  useFocusEffect(useCallback(() => { refreshUser(); }, []));

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0]} 👋</Text>
          <Pressable onPress={logout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
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
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Start New Quiz</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:          { flex: 1 },
  orb1:        {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  orb2:        {
    position: 'absolute', bottom: 50, left: -100,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  container:   { flex: 1, paddingHorizontal: screenPadding },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2xl'] },
  greeting:    { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary },
  logoutText:  { fontSize: typography.scale.sm, color: colors.text.muted },
  card:        {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  cardTitle:   { fontSize: typography.scale.md, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: spacing.lg },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statItem:    { flex: 1, minWidth: '40%', alignItems: 'center', backgroundColor: colors.bg.raised, borderRadius: radius.md, padding: spacing.lg },
  statValue:   { fontSize: typography.scale.xl, fontWeight: typography.weights.bold, color: colors.accent.primary },
  statLabel:   { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: spacing.xs },
  btnWrapper:  { marginBottom: spacing.xl },
  btn:         { borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  btnText:     { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.semibold },
});
