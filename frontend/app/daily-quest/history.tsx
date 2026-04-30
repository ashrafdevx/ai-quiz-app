import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dailyQuestApi, type DailyQuestDay, type DailyQuestEntry } from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  // iso is YYYY-MM-DD in UTC; treat as local day for display
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, today))     return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(score: number) {
  if (score >= 80) return colors.accent.success;
  if (score >= 60) return colors.accent.warning;
  return colors.accent.danger;
}

const DIFF_COLORS: Record<string, string> = {
  easy:   colors.accent.success,
  medium: colors.accent.warning,
  hard:   colors.accent.danger,
};

// ── EntryRow ──────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: DailyQuestEntry }) {
  const [expanded, setExpanded] = useState(false);
  const sc = scoreColor(entry.score);

  return (
    <View style={styles.entryCard}>
      {/* Collapsed row */}
      <Pressable onPress={() => setExpanded(v => !v)} style={styles.entryHeader}>
        <View style={[styles.statusDot, { backgroundColor: entry.isCorrect ? colors.accent.success : colors.accent.danger }]} />
        <Text style={styles.entryQuestion} numberOfLines={expanded ? undefined : 2}>
          {entry.question}
        </Text>
        <View style={[styles.entryScore, { backgroundColor: sc + '20' }]}>
          <Text style={[styles.entryScoreText, { color: sc }]}>{entry.score}%</Text>
        </View>
      </Pressable>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.entryDetail}>
          {/* Difficulty + topic */}
          <View style={styles.metaRow}>
            <Text style={[styles.metaBadge, { color: DIFF_COLORS[entry.difficulty] ?? colors.text.muted }]}>
              {entry.difficulty}
            </Text>
            {!!entry.topic && <Text style={styles.metaTopic}>{entry.topic}</Text>}
          </View>

          {/* AI feedback */}
          {!!entry.feedback && (
            <Text style={styles.feedbackText}>{entry.feedback}</Text>
          )}

          {/* Your answer */}
          <View style={styles.answerBlock}>
            <Text style={styles.blockLabel}>Your Answer</Text>
            <Text style={styles.blockText}>{entry.userAnswer || '(no answer recorded)'}</Text>
          </View>

          {/* Correct answer */}
          <View style={[styles.answerBlock, styles.correctBlock]}>
            <Text style={[styles.blockLabel, { color: colors.accent.primary }]}>Correct Answer</Text>
            <Text style={styles.blockText}>{entry.correctAnswer}</Text>
          </View>

          {/* Tips */}
          {entry.tips?.length > 0 && (
            <View style={styles.tipsWrap}>
              <Text style={styles.blockLabel}>Key Points</Text>
              {entry.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── DaySection ────────────────────────────────────────────────────────────────

function DaySection({ day }: { day: DailyQuestDay }) {
  const [collapsed, setCollapsed] = useState(false);
  const sc = scoreColor(day.avgScore);

  return (
    <View style={styles.daySection}>
      <Pressable onPress={() => setCollapsed(v => !v)} style={styles.dayHeader}>
        <View style={styles.dayHeaderLeft}>
          <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
          <View style={styles.dayMeta}>
            <Text style={styles.dayMetaText}>
              {day.correct}/{day.total} correct
            </Text>
            <View style={[styles.dayAvgBadge, { backgroundColor: sc + '20' }]}>
              <Text style={[styles.dayAvgText, { color: sc }]}>avg {day.avgScore}%</Text>
            </View>
          </View>
        </View>
        <Text style={styles.collapseIcon}>{collapsed ? '▶' : '▼'}</Text>
      </Pressable>

      {!collapsed && (
        <View style={styles.dayEntries}>
          {day.entries.map(e => <EntryRow key={e._id} entry={e} />)}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DailyQuestHistoryScreen() {
  const router = useRouter();

  const [days,       setDays]       = useState<DailyQuestDay[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await dailyQuestApi.history();
      setDays(data.days);
      setTotal(data.total);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(true); };

  // Aggregate stats
  const totalDays    = days.length;
  const totalCorrect = days.reduce((s, d) => s + d.correct, 0);
  const overallAvg   = total > 0
    ? Math.round(days.reduce((s, d) => s + d.avgScore * d.total, 0) / total)
    : 0;

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
        }
      >
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Quest History</Text>
          <View style={{ width: 60 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing['3xl'] }} />
        ) : (
          <>
            {/* Summary stats */}
            {total > 0 && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{total}</Text>
                  <Text style={styles.statLabel}>Questions</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: colors.accent.success }]}>{totalCorrect}</Text>
                  <Text style={styles.statLabel}>Correct</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: colors.accent.info }]}>{totalDays}</Text>
                  <Text style={styles.statLabel}>Days</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: scoreColor(overallAvg) }]}>{overallAvg}%</Text>
                  <Text style={styles.statLabel}>Avg Score</Text>
                </View>
              </View>
            )}

            {/* Timeline */}
            {days.length > 0 ? (
              <View style={styles.timeline}>
                {days.map(day => <DaySection key={day.date} day={day} />)}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.emptyBody}>
                  Complete your first Daily Quest to start building your learning history.
                </Text>
                <Pressable onPress={() => router.back()} style={styles.emptyBtn}>
                  <LinearGradient
                    colors={['#6C63FF', '#A855F7']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.emptyBtnGrad}
                  >
                    <Text style={styles.emptyBtnText}>Go to Daily Quest</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  safeArea: { flex: 1 },
  orb1:  { position: 'absolute', top: -100, right: -80,  width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  orb2:  { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168, 85, 247, 0.08)' },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing['2xl'] },

  topBar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  backBtn:  { width: 60 },
  backText: { fontSize: typography.scale.sm, color: colors.accent.primary },
  title:    { fontSize: typography.scale.xl, fontWeight: typography.weights.bold, color: colors.text.primary },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.md,
  },
  statValue: { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.accent.primary },
  statLabel: { fontSize: 10, color: colors.text.muted, marginTop: 2 },

  timeline: { gap: spacing.md },

  daySection: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg,
  },
  dayHeaderLeft: { flex: 1 },
  dayDate:       { fontSize: typography.scale.md, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: 4 },
  dayMeta:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayMetaText:   { fontSize: typography.scale.xs, color: colors.text.muted },
  dayAvgBadge:   { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  dayAvgText:    { fontSize: typography.scale.xs, fontWeight: typography.weights.bold },
  collapseIcon:  { fontSize: 10, color: colors.text.muted, paddingLeft: spacing.sm },

  dayEntries: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },

  entryCard: {
    backgroundColor: colors.bg.raised,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, gap: spacing.sm },
  statusDot:   { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  entryQuestion: { flex: 1, fontSize: typography.scale.sm, color: colors.text.primary, lineHeight: 20 },
  entryScore:  { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, marginLeft: spacing.xs },
  entryScoreText: { fontSize: 10, fontWeight: typography.weights.bold },

  entryDetail: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },

  metaRow:    { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  metaBadge:  { fontSize: typography.scale.xs, fontWeight: typography.weights.semibold, textTransform: 'capitalize' },
  metaTopic:  { fontSize: typography.scale.xs, color: colors.text.muted },
  feedbackText: { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  answerBlock: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.subtle,
    padding: spacing.md, gap: spacing.xs,
  },
  correctBlock: { borderColor: 'rgba(108,99,255,0.2)', backgroundColor: 'rgba(108,99,255,0.06)' },
  blockLabel:   { fontSize: 10, fontWeight: typography.weights.bold, color: colors.text.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  blockText:    { fontSize: typography.scale.sm, color: colors.text.primary, lineHeight: 20 },

  tipsWrap: { gap: spacing.sm },
  tipRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent.primary, marginTop: 7 },
  tipText:  { flex: 1, fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  emptyState: { alignItems: 'center', paddingTop: spacing['3xl'], gap: spacing.md },
  emptyIcon:  { fontSize: 56 },
  emptyTitle: { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary },
  emptyBody:  { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyBtn:   { borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.sm },
  emptyBtnGrad: { paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  emptyBtnText: { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },
});
