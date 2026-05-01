import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
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

function motivationalLine(sessions: number): string {
  if (sessions === 0) return 'Upload a doc & start your first quiz';
  if (sessions < 5)  return 'Great start — keep the momentum going';
  if (sessions < 20) return "You're building real momentum 🚀";
  return "You're on fire — keep going 🔥";
}

export default function HomeScreen() {
  const { user, logout, refreshUser } = useAuthStore();
  const router = useRouter();
  const stats     = user?.stats;
  const { colors, isDark, toggle } = useTheme();

  useFocusEffect(useCallback(() => { refreshUser(); }, []));

  const styles    = makeStyles(colors);
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const initial   = firstName[0]?.toUpperCase() ?? 'U';

  return (
    <LinearGradient colors={colors.gradient.bg} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient colors={['#6C63FF', '#A855F7']} style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              <View>
                <Text style={styles.greetingSmall}>{greeting()}</Text>
                <Text style={styles.greetingName}>{firstName} 👋</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={toggle} style={styles.iconBtn}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={19}
                  color={colors.text.secondary}
                />
              </Pressable>
              <Pressable onPress={logout} style={styles.iconBtn}>
                <Ionicons name="log-out-outline" size={19} color={colors.text.muted} />
              </Pressable>
            </View>
          </View>

          {/* ── Hero CTA ── */}
          <Pressable onPress={() => router.navigate('/(tabs)/upload')} style={styles.heroWrapper}>
            <LinearGradient
              colors={['#6C63FF', '#A855F7', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroBubble1} />
              <View style={styles.heroBubble2} />
              <View style={styles.heroRow}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="flash" size={24} color="#fff" />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>Start New Quiz</Text>
                  <Text style={styles.heroSub}>{motivationalLine(stats?.totalSessions ?? 0)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.65)" />
              </View>
            </LinearGradient>
          </Pressable>

          {/* ── Stats ── */}
          <Text style={styles.sectionLabel}>YOUR PROGRESS</Text>
          <View style={styles.statsGrid}>
            <StatTile icon="trending-up" value={`${stats?.avgScore ?? 0}%`}  label="Avg Score"  accent="#6C63FF" colors={colors} />
            <StatTile icon="trophy"      value={`${stats?.bestScore ?? 0}%`} label="Best Score" accent="#F59E0B" colors={colors} />
            <StatTile icon="library"     value={String(stats?.totalSessions ?? 0)} label="Sessions"   accent="#10B981" colors={colors} />
            <StatTile icon="flame"       value={String(stats?.streak ?? 0)}  label="Day Streak" accent="#EC4899" colors={colors} />
          </View>

          {/* ── Quick Actions ── */}
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionCard} onPress={() => router.navigate('/(tabs)/daily')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(236,72,153,0.14)' }]}>
                <Ionicons name="calendar" size={20} color="#EC4899" />
              </View>
              <Text style={styles.actionTitle}>Daily{'\n'}Challenge</Text>
              <Text style={styles.actionSub}>Stay consistent</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => router.navigate('/(tabs)/sessions')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(56,189,248,0.14)' }]}>
                <Ionicons name="time" size={20} color="#38BDF8" />
              </View>
              <Text style={styles.actionTitle}>Past{'\n'}Sessions</Text>
              <Text style={styles.actionSub}>Review history</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => router.navigate('/(tabs)/analytics')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                <Ionicons name="bar-chart" size={20} color="#10B981" />
              </View>
              <Text style={styles.actionTitle}>Analytics</Text>
              <Text style={styles.actionSub}>Track growth</Text>
            </Pressable>
          </View>

          {/* ── Streak banner (only when streak > 0) ── */}
          {(stats?.streak ?? 0) > 0 && (
            <LinearGradient
              colors={['rgba(236,72,153,0.10)', 'rgba(168,85,247,0.10)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.streakBanner}
            >
              <Text style={styles.streakEmoji}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakTitle}>{stats?.streak}-day streak!</Text>
                <Text style={styles.streakSub}>Don't break the chain — quiz again today</Text>
              </View>
            </LinearGradient>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  icon: string;
  value: string;
  label: string;
  accent: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

function StatTile({ icon, value, label, accent, colors }: StatTileProps) {
  return (
    <View style={[statTileBase(colors), { flex: 1, minWidth: '45%' }]}>
      <View style={[statIconWrap, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={icon as any} size={17} color={accent} />
      </View>
      <Text style={[statValue, { color: accent }]}>{value}</Text>
      <Text style={[statLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

const statIconWrap: object = {
  width: 34, height: 34, borderRadius: radius.sm,
  alignItems: 'center', justifyContent: 'center',
  marginBottom: spacing.sm,
};
const statValue: object = {
  fontSize: typography.scale.xl,
  fontWeight: typography.weights.bold,
  marginBottom: 2,
};
const statLabel: object = {
  fontSize: typography.scale.xs,
};
function statTileBase(colors: ReturnType<typeof useTheme>['colors']): object {
  return {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
  };
}

// ── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    bg:      { flex: 1 },
    safeArea:{ flex: 1 },
    scroll:  { flex: 1 },
    scrollContent: {
      paddingHorizontal: screenPadding,
      paddingTop: spacing.md,
      paddingBottom: spacing['3xl'],
    },
    orb1: {
      position: 'absolute', top: -100, right: -80,
      width: 300, height: 300, borderRadius: 150,
      backgroundColor: 'rgba(108,99,255,0.12)',
    },
    orb2: {
      position: 'absolute', bottom: 50, left: -100,
      width: 250, height: 250, borderRadius: 125,
      backgroundColor: 'rgba(168,85,247,0.08)',
    },

    // Header
    header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
    headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText:   { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.bold },
    greetingSmall:{ fontSize: typography.scale.xs, color: colors.text.muted },
    greetingName: { fontSize: typography.scale.md, fontWeight: typography.weights.bold, color: colors.text.primary },
    headerActions:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconBtn:      { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg.surface },

    // Hero
    heroWrapper: { marginBottom: spacing['2xl'] },
    heroCard:    { borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden' },
    heroBubble1: {
      position: 'absolute', top: -50, right: -30,
      width: 130, height: 130, borderRadius: 65,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroBubble2: {
      position: 'absolute', bottom: -40, left: -20,
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    heroIconWrap:{
      width: 48, height: 48, borderRadius: radius.lg,
      backgroundColor: 'rgba(255,255,255,0.20)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroTextWrap:{ flex: 1 },
    heroTitle:   { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: '#fff' },
    heroSub:     { fontSize: typography.scale.sm, color: 'rgba(255,255,255,0.72)', marginTop: 3 },

    // Section labels
    sectionLabel:{
      fontSize: typography.scale.xs, fontWeight: typography.weights.semibold,
      color: colors.text.muted, letterSpacing: 1.1,
      marginBottom: spacing.md,
    },

    // Stats grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing['2xl'] },

    // Actions
    actionsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing['2xl'] },
    actionCard: {
      flex: 1,
      backgroundColor: colors.bg.surface,
      borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border.default,
      padding: spacing.md,
    },
    actionIcon: {
      width: 40, height: 40, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    actionTitle:{ fontSize: typography.scale.sm, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: 2 },
    actionSub:  { fontSize: typography.scale.xs, color: colors.text.muted },

    // Streak
    streakBanner:{
      flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
      borderRadius: radius.lg, padding: spacing.lg,
      borderWidth: 1, borderColor: 'rgba(236,72,153,0.20)',
    },
    streakEmoji: { fontSize: 30 },
    streakTitle: { fontSize: typography.scale.base, fontWeight: typography.weights.bold, color: colors.text.primary },
    streakSub:   { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: 2 },
  });
}
