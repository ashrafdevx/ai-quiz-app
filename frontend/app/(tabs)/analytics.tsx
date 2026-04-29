import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyticsApi, type PerformanceData, type ScoreEntry } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

const BAR_TRACK_HEIGHT = 100;

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TrendBadge({ trend }: { trend: PerformanceData['recentTrend'] }) {
  const map = {
    improving: { icon: '↑', label: 'Improving', color: colors.accent.success, bg: 'rgba(16,185,129,0.15)' },
    declining: { icon: '↓', label: 'Declining',  color: colors.accent.danger,  bg: 'rgba(239,68,68,0.15)' },
    stable:    { icon: '→', label: 'Stable',     color: colors.accent.warning, bg: 'rgba(245,158,11,0.15)' },
  };
  const cfg = map[trend] ?? map.stable;
  return (
    <View style={[styles.trendBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.trendIcon, { color: cfg.color }]}>{cfg.icon}</Text>
      <Text style={[styles.trendLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function ScoreTrendChart({ history }: { history: ScoreEntry[] }) {
  const bars = [...history].reverse(); // oldest → newest left → right
  return (
    <View style={styles.chartSection}>
      <Text style={styles.sectionTitle}>Score History</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.barsRow}>
          {bars.map((entry, i) => {
            const barColor =
              entry.score >= 80 ? colors.accent.success
              : entry.score >= 50 ? colors.accent.warning
              : colors.accent.danger;
            const fillPct = `${Math.max(4, entry.score)}%`;
            return (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barScore}>{entry.score}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: fillPct, backgroundColor: barColor }]} />
                </View>
                <Text style={styles.barDate} numberOfLines={1}>
                  {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuthStore();
  const [perf, setPerf]             = useState<PerformanceData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ data }] = await Promise.all([analyticsApi.performance(), refreshUser()]);
      setPerf(data);
    } catch {
      // keep previous data visible on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(true); };
  const stats = user?.stats;

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Analytics</Text>
            <Text style={styles.subtitle}>Performance overview</Text>
          </View>
          {perf && <TrendBadge trend={perf.recentTrend} />}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing['3xl'] }} />
        ) : (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCard label="Avg Score"  value={`${stats?.avgScore  ?? 0}%`}           color={colors.accent.primary} />
              <StatCard label="Best Score" value={`${stats?.bestScore ?? 0}%`}            color={colors.accent.success} />
              <StatCard label="Sessions"   value={String(stats?.totalSessions ?? 0)}      color={colors.accent.info} />
              <StatCard label="Day Streak" value={`${stats?.streak ?? 0} 🔥`}            color={colors.accent.warning} />
            </View>

            {/* Score trend chart or empty placeholder */}
            {(perf?.scoreHistory?.length ?? 0) > 0 ? (
              <ScoreTrendChart history={perf!.scoreHistory} />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>Complete sessions to see your score trend</Text>
              </View>
            )}

            {/* Weak areas */}
            {(perf?.weakTopics?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Areas to Improve</Text>
                {perf!.weakTopics.map((topic, i) => (
                  <View key={i} style={styles.topicRow}>
                    <View style={styles.topicDot} />
                    <Text style={styles.topicText}>{topic}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Full empty state */}
            {!perf?.scoreHistory?.length && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyTitle}>No data yet</Text>
                <Text style={styles.emptyBody}>
                  Complete quiz sessions to start tracking your performance trends.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:    { flex: 1 },
  orb1:  { position: 'absolute', top: -100, right: -80,  width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  orb2:  { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168, 85, 247, 0.08)' },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingBottom: 48 },

  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2xl'] },
  title:    { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: 2 },

  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  trendIcon:  { fontSize: 14, fontWeight: typography.weights.bold },
  trendLabel: { fontSize: typography.scale.xs, fontWeight: typography.weights.semibold },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing['2xl'] },
  statCard: {
    flex: 1, minWidth: '40%',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.lg, alignItems: 'center',
  },
  statValue: { fontSize: typography.scale.xl, fontWeight: typography.weights.bold },
  statLabel: { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: spacing.xs },

  chartSection: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: typography.scale.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingBottom: 4 },
  barCol:  { alignItems: 'center', width: 48 },
  barScore: { fontSize: 10, color: colors.text.muted, marginBottom: 2 },
  barTrack: {
    width: 30, height: BAR_TRACK_HEIGHT,
    backgroundColor: colors.bg.raised,
    borderRadius: radius.sm, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: radius.sm },
  barDate: { fontSize: 9, color: colors.text.muted, marginTop: 4, width: 48, textAlign: 'center' },

  emptyChart: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  emptyChartText: { color: colors.text.muted, fontSize: typography.scale.sm, textAlign: 'center' },

  section: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  topicRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  topicDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.danger, marginTop: 6 },
  topicText: { flex: 1, fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  emptyState: { alignItems: 'center', paddingTop: spacing['2xl'] },
  emptyIcon:  { fontSize: 56, marginBottom: spacing.lg },
  emptyTitle: { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyBody:  { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
});
