import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  sessionsApi, dailyQuestApi,
  type Session, type DailyQuestEntry,
} from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'session'; data: Session;          date: Date }
  | { kind: 'daily';   data: DailyQuestEntry;  date: Date };

type TypeFilter = 'all' | 'session' | 'daily';
type DateFilter = 'all' | 'today' | 'week';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(d: Date) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function isThisWeek(d: Date) {
  return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function scoreStyle(score: number) {
  if (score >= 80) return { color: colors.accent.success, bg: 'rgba(16,185,129,0.15)' };
  if (score >= 50) return { color: colors.accent.warning, bg: 'rgba(245,158,11,0.15)' };
  return { color: colors.accent.danger, bg: 'rgba(239,68,68,0.15)' };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const { color, bg } = scoreStyle(score);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{score}%</Text>
    </View>
  );
}

function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const inProgress = session.status === 'in_progress';
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <View style={styles.cardRow}>
        <Text style={styles.cardIcon}>📄</Text>
        <View style={styles.cardBody}>
          <View style={styles.kindRow}>
            <View style={styles.kindBadge}><Text style={styles.kindText}>Quiz</Text></View>
          </View>
          <Text style={styles.cardName} numberOfLines={1}>{session.documentName}</Text>
          <Text style={styles.cardMeta}>
            {session.questions.length} questions · {session.interviewType} · {session.difficulty}
          </Text>
          <Text style={styles.cardDate}>{formatDate(new Date(session.createdAt))}</Text>
        </View>
        {inProgress
          ? <View style={[styles.badge, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
              <Text style={[styles.badgeText, { color: colors.accent.info }]}>In Progress</Text>
            </View>
          : <ScoreBadge score={session.score} />
        }
      </View>
    </Pressable>
  );
}

function DailyCard({ entry }: { entry: DailyQuestEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable style={[styles.card, expanded && styles.cardOpen]} onPress={() => setExpanded(v => !v)}>
      <View style={styles.cardRow}>
        <Text style={styles.cardIcon}>📅</Text>
        <View style={styles.cardBody}>
          <View style={styles.kindRow}>
            <View style={[styles.kindBadge, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
              <Text style={[styles.kindText, { color: '#A855F7' }]}>Daily</Text>
            </View>
            <Text style={styles.diffText}>{entry.difficulty}</Text>
          </View>
          <Text style={styles.cardName} numberOfLines={expanded ? undefined : 2}>{entry.question}</Text>
          <Text style={styles.cardDate}>{formatDate(new Date(entry.completedAt))}</Text>
        </View>
        <View style={styles.rightCol}>
          <ScoreBadge score={entry.score} />
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.qaBlock}>
            <Text style={styles.qaLabel}>Your Answer</Text>
            <Text style={styles.qaText}>{entry.userAnswer}</Text>
          </View>
          <View style={styles.qaBlock}>
            <Text style={styles.qaLabel}>AI Feedback</Text>
            <Text style={styles.qaText}>{entry.feedback}</Text>
          </View>
          <View style={styles.qaBlock}>
            <Text style={[styles.qaLabel, { color: colors.accent.success }]}>Correct Answer</Text>
            <Text style={styles.qaText}>{entry.correctAnswer}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<FeedItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sessRes, dqRes] = await Promise.all([
        sessionsApi.list(),
        dailyQuestApi.history(500, 0),
      ]);

      const sessionItems: FeedItem[] = (Array.isArray(sessRes.data) ? sessRes.data : []).map(s => ({
        kind: 'session' as const, data: s, date: new Date(s.createdAt),
      }));

      const dailyItems: FeedItem[] = (dqRes.data.days ?? [])
        .flatMap(d => d.entries)
        .map(e => ({ kind: 'daily' as const, data: e, date: new Date(e.completedAt) }));

      setItems(
        [...sessionItems, ...dailyItems].sort((a, b) => b.date.getTime() - a.date.getTime())
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(true); };

  const visible = items.filter(item => {
    if (typeFilter === 'session' && item.kind !== 'session') return false;
    if (typeFilter === 'daily'   && item.kind !== 'daily')   return false;
    if (dateFilter === 'today'   && !isToday(item.date))     return false;
    if (dateFilter === 'week'    && !isThisWeek(item.date))  return false;
    return true;
  });

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sessions</Text>
              <Text style={styles.subtitle}>Your complete quiz history</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
              onPress={() => router.push('/session/new')}
            >
              <LinearGradient
                colors={['#6C63FF', '#A855F7']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.newBtnGrad}
              >
                <Text style={styles.newBtnText}>+ New</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Type filter */}
          <View style={styles.filterRow}>
            {(['all', 'session', 'daily'] as TypeFilter[]).map(f => (
              <Pressable
                key={f}
                style={[styles.chip, typeFilter === f && styles.chipActive]}
                onPress={() => setTypeFilter(f)}
              >
                <Text style={[styles.chipText, typeFilter === f && styles.chipTextActive]}>
                  {f === 'all' ? 'All' : f === 'session' ? 'Quiz' : 'Daily'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Date filter */}
          <View style={[styles.filterRow, { marginBottom: spacing.xl }]}>
            {(['all', 'today', 'week'] as DateFilter[]).map(f => (
              <Pressable
                key={f}
                style={[styles.chip, dateFilter === f && styles.chipDate]}
                onPress={() => setDateFilter(f)}
              >
                <Text style={[styles.chipText, dateFilter === f && styles.chipTextActive]}>
                  {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : 'This Week'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing['3xl'] }} />
          ) : visible.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyTitle}>No records yet</Text>
              <Text style={styles.emptyBody}>
                {typeFilter === 'daily'
                  ? 'Complete daily quests to see them here.'
                  : 'Upload a document and start your first quiz session.'}
              </Text>
              {typeFilter !== 'daily' && (
                <Pressable
                  style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/session/new')}
                >
                  <LinearGradient
                    colors={['#6C63FF', '#A855F7', '#EC4899']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.emptyBtnGrad}
                  >
                    <Text style={styles.emptyBtnText}>Start First Session</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.list}>
              {visible.map(item =>
                item.kind === 'session' ? (
                  <SessionCard
                    key={`s-${item.data.id}`}
                    session={item.data}
                    onPress={() =>
                      item.data.status === 'completed'
                        ? router.push({ pathname: '/session/result', params: { id: item.data.id } })
                        : router.push(`/session/${item.data.id}`)
                    }
                  />
                ) : (
                  <DailyCard key={`d-${item.data._id}`} entry={item.data} />
                )
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  safeArea: { flex: 1 },
  orb1:     { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108,99,255,0.12)' },
  orb2:     { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168,85,247,0.08)' },
  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing['2xl'] },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title:      { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle:   { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: 2 },
  newBtn:     { borderRadius: radius.full },
  newBtnGrad: { borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  newBtnText: { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },

  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip:      { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border.default, backgroundColor: 'transparent' },
  chipActive: { backgroundColor: 'rgba(108,99,255,0.18)', borderColor: colors.accent.primary },
  chipDate:   { backgroundColor: 'rgba(168,85,247,0.18)', borderColor: '#A855F7' },
  chipText:      { fontSize: typography.scale.xs, color: colors.text.muted, fontWeight: typography.weights.medium },
  chipTextActive: { color: colors.text.primary },

  list: { gap: spacing.md },

  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
  },
  cardOpen: { borderColor: colors.accent.primary },

  cardRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  cardIcon: { fontSize: 26, marginRight: spacing.md, marginTop: 2 },
  cardBody: { flex: 1 },

  kindRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  kindBadge: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(108,99,255,0.12)' },
  kindText:  { fontSize: 10, fontWeight: typography.weights.bold, color: colors.accent.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  diffText:  { fontSize: 10, color: colors.text.muted, textTransform: 'capitalize' },

  cardName: { fontSize: typography.scale.base, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: 2 },
  cardMeta: { fontSize: typography.scale.xs, color: colors.text.secondary, textTransform: 'capitalize', marginBottom: 2 },
  cardDate: { fontSize: typography.scale.xs, color: colors.text.muted },

  badge:     { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, marginLeft: spacing.sm },
  badgeText: { fontSize: typography.scale.xs, fontWeight: typography.weights.bold },

  rightCol: { alignItems: 'center', gap: spacing.xs },
  chevron:  { fontSize: 9, color: colors.text.muted, marginTop: 4 },

  expanded: { marginTop: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing.lg },
  qaBlock:  { gap: 4 },
  qaLabel:  { fontSize: typography.scale.xs, fontWeight: typography.weights.semibold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  qaText:   { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  empty:        { alignItems: 'center', paddingTop: spacing['3xl'] },
  emptyIcon:    { fontSize: 56, marginBottom: spacing.lg },
  emptyTitle:   { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyBody:    { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', marginBottom: spacing['2xl'], paddingHorizontal: spacing.xl },
  emptyBtn:     { borderRadius: radius.md },
  emptyBtnGrad: { borderRadius: radius.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  emptyBtnText: { color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },
});
