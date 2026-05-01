import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  sessionsApi, dailyQuestApi, interviewApi,
  type Session, type DailyQuestEntry, type InterviewSession, type InterviewMessage,
} from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'quiz';      data: Session;          date: Date }
  | { kind: 'interview'; data: Omit<InterviewSession, 'messages'>; date: Date }
  | { kind: 'daily';     data: DailyQuestEntry;  date: Date };

type TypeFilter = 'all' | 'quiz' | 'interview' | 'daily';
type DateFilter = 'all' | 'today' | 'week';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(d: Date) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function isThisWeek(d: Date) {
  return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function scoreColor(s: number) {
  if (s >= 80) return { fg: colors.accent.success, bg: 'rgba(16,185,129,0.15)' };
  if (s >= 50) return { fg: colors.accent.warning, bg: 'rgba(245,158,11,0.15)' };
  return { fg: colors.accent.danger, bg: 'rgba(239,68,68,0.15)' };
}

const CATEGORY_COLOR: Record<string, string> = {
  web: '#3B82F6', 'react-native': '#61DAFB', android: '#3DDC84',
  devops: '#F97316', python: '#3776AB', java: '#ED8B00',
  database: '#10B981', 'system-design': '#8B5CF6', behavioral: '#EC4899',
  algorithms: '#6C63FF', javascript: '#F7DF1E', typescript: '#3178C6', other: '#94A3B8',
};

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, suffix = '%' }: { score: number; suffix?: string }) {
  const { fg, bg } = scoreColor(score);
  return (
    <View style={[badge.wrap, { backgroundColor: bg }]}>
      <Text style={[badge.text, { color: fg }]}>{score}{suffix}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  text: { fontSize: typography.scale.xs, fontWeight: typography.weights.bold },
});

// ─── Quiz card (expandable) ───────────────────────────────────────────────────

function QuizCard({ session, onNavigate }: { session: Session; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const inProgress = session.status === 'in_progress';
  const hasAnswers  = session.answers?.length > 0;

  return (
    <View style={[card.wrap, open && card.wrapOpen]}>
      {/* Header row */}
      <Pressable onPress={() => setOpen(v => !v)} style={card.row}>
        <View style={[card.iconWrap, { backgroundColor: 'rgba(108,99,255,0.12)' }]}>
          <Ionicons name="document-text" size={18} color="#6C63FF" />
        </View>
        <View style={card.body}>
          <View style={card.kindRow}>
            <View style={[card.kindBadge, { backgroundColor: 'rgba(108,99,255,0.12)' }]}>
              <Text style={[card.kindText, { color: '#6C63FF' }]}>QUIZ</Text>
            </View>
            <Text style={card.meta}>{session.interviewType} · {session.difficulty}</Text>
          </View>
          <Text style={card.title} numberOfLines={1}>{session.documentName}</Text>
          <Text style={card.date}>{fmtDate(new Date(session.createdAt))}</Text>
        </View>
        <View style={card.rightCol}>
          {inProgress
            ? <View style={[badge.wrap, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
                <Text style={[badge.text, { color: colors.accent.info }]}>Active</Text>
              </View>
            : <ScoreBadge score={session.score} />
          }
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text.muted} />
        </View>
      </Pressable>

      {/* Expanded: Q&A pairs */}
      {open && (
        <View style={card.expanded}>
          {session.questions?.map((q, i) => {
            const ans = session.answers?.find(a => a.questionId === q.id);
            const fbQ = session.feedback?.questions?.find((fq: any) => fq.id === q.id);
            return (
              <View key={q.id} style={card.qaBlock}>
                <Text style={card.qaIdx}>Q{i + 1}</Text>
                <Text style={card.qaQuestion}>{q.text}</Text>
                {ans?.transcript ? (
                  <>
                    <Text style={card.qaLabel}>Your answer</Text>
                    <Text style={card.qaText}>{ans.transcript}</Text>
                  </>
                ) : (
                  <Text style={card.qaSkipped}>— Skipped</Text>
                )}
                {fbQ && (
                  <>
                    <Text style={[card.qaLabel, { color: colors.accent.success }]}>Feedback</Text>
                    {fbQ.strengths?.length > 0 && (
                      <Text style={card.qaText}>✓ {fbQ.strengths.join(' · ')}</Text>
                    )}
                    {fbQ.improvements?.length > 0 && (
                      <Text style={card.qaText}>↑ {fbQ.improvements.join(' · ')}</Text>
                    )}
                  </>
                )}
              </View>
            );
          })}
          {!hasAnswers && (
            <Text style={card.noData}>No answers recorded yet.</Text>
          )}
          <Pressable onPress={onNavigate} style={card.viewBtn}>
            <Text style={card.viewBtnText}>
              {inProgress ? 'Continue session →' : 'View full results →'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Interview card (expandable, lazy-loads messages) ─────────────────────────

function InterviewCard({ session }: { session: Omit<InterviewSession, 'messages'> }) {
  const [open,        setOpen]        = useState(false);
  const [messages,    setMessages]    = useState<InterviewMessage[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const catColor = CATEGORY_COLOR[session.category] ?? '#94A3B8';

  async function handleExpand() {
    setOpen(v => !v);
    if (!messages && !loadingMsgs) {
      setLoadingMsgs(true);
      try {
        const { data } = await interviewApi.get(session._id);
        setMessages(data.session.messages);
      } catch { setMessages([]); }
      finally { setLoadingMsgs(false); }
    }
  }

  // Group messages into Q&A+feedback triplets
  const pairs: Array<{ question: string; answer: string; mode: string; evaluation: any }> = [];
  if (messages) {
    const byIndex: Record<number, { q?: string; a?: string; mode?: string; ev?: any }> = {};
    for (const m of messages) {
      const idx = m.questionIndex ?? 0;
      if (!byIndex[idx]) byIndex[idx] = {};
      if (m.role === 'ai')       byIndex[idx].q  = m.content;
      if (m.role === 'user')     { byIndex[idx].a  = m.content; byIndex[idx].mode = m.inputMode; }
      if (m.role === 'feedback') byIndex[idx].ev = m.evaluation;
    }
    for (const idx of Object.keys(byIndex).map(Number).sort()) {
      const p = byIndex[idx];
      if (p.q) pairs.push({ question: p.q, answer: p.a ?? '—', mode: p.mode ?? 'text', evaluation: p.ev });
    }
  }

  return (
    <View style={[card.wrap, open && card.wrapOpen]}>
      {/* Header row */}
      <Pressable onPress={handleExpand} style={card.row}>
        <View style={[card.iconWrap, { backgroundColor: `${catColor}18` }]}>
          <Ionicons name="chatbubbles" size={18} color={catColor} />
        </View>
        <View style={card.body}>
          <View style={card.kindRow}>
            <View style={[card.kindBadge, { backgroundColor: `${catColor}18` }]}>
              <Text style={[card.kindText, { color: catColor }]}>INTERVIEW</Text>
            </View>
            <Text style={card.meta}>{session.category}</Text>
          </View>
          <Text style={card.title} numberOfLines={1}>{session.topic}</Text>
          <Text style={card.date}>{fmtDate(new Date(session.createdAt))}</Text>
        </View>
        <View style={card.rightCol}>
          {session.avgScore > 0 ? <ScoreBadge score={session.avgScore} /> : (
            <View style={[badge.wrap, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
              <Text style={[badge.text, { color: colors.accent.info }]}>
                {session.status === 'completed' ? 'Done' : 'Active'}
              </Text>
            </View>
          )}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text.muted} />
        </View>
      </Pressable>

      {/* Expanded */}
      {open && (
        <View style={card.expanded}>
          {loadingMsgs ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginVertical: spacing.lg }} />
          ) : pairs.length === 0 ? (
            <Text style={card.noData}>No Q&A recorded yet.</Text>
          ) : (
            pairs.map((p, i) => {
              const sc = p.evaluation?.score;
              return (
                <View key={i} style={card.qaBlock}>
                  <Text style={card.qaIdx}>Q{i + 1}</Text>
                  <Text style={card.qaQuestion}>{p.question}</Text>
                  {p.mode === 'voice' && (
                    <View style={interviewCard.voiceTag}>
                      <Ionicons name="mic" size={11} color="#A855F7" />
                      <Text style={interviewCard.voiceText}>Voice</Text>
                    </View>
                  )}
                  <Text style={card.qaLabel}>Your answer</Text>
                  <Text style={card.qaText}>{p.answer}</Text>
                  {p.evaluation && (
                    <>
                      <View style={interviewCard.evalRow}>
                        {sc != null && (
                          <ScoreBadge score={sc} suffix="/100" />
                        )}
                        <Text style={card.qaText} numberOfLines={2}>{p.evaluation.feedback}</Text>
                      </View>
                      {p.evaluation.improvedAnswer ? (
                        <>
                          <Text style={[card.qaLabel, { color: '#6C63FF' }]}>Model answer</Text>
                          <Text style={card.qaText}>{p.evaluation.improvedAnswer}</Text>
                        </>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const interviewCard = StyleSheet.create({
  voiceTag:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  voiceText: { fontSize: 10, color: '#A855F7' },
  evalRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 4 },
});

// ─── Daily card (expandable) ──────────────────────────────────────────────────

function DailyCard({ entry }: { entry: DailyQuestEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[card.wrap, open && card.wrapOpen]}>
      <Pressable onPress={() => setOpen(v => !v)} style={card.row}>
        <View style={[card.iconWrap, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
          <Ionicons name="star" size={18} color="#A855F7" />
        </View>
        <View style={card.body}>
          <View style={card.kindRow}>
            <View style={[card.kindBadge, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
              <Text style={[card.kindText, { color: '#A855F7' }]}>DAILY</Text>
            </View>
            <Text style={card.meta}>{entry.difficulty} · {entry.topic}</Text>
          </View>
          <Text style={card.title} numberOfLines={open ? 0 : 2}>{entry.question}</Text>
          <Text style={card.date}>{fmtDate(new Date(entry.completedAt))}</Text>
        </View>
        <View style={card.rightCol}>
          <ScoreBadge score={entry.score} />
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text.muted} />
        </View>
      </Pressable>

      {open && (
        <View style={card.expanded}>
          <View style={card.qaBlock}>
            <Text style={card.qaLabel}>Your Answer</Text>
            <Text style={card.qaText}>{entry.userAnswer}</Text>
          </View>
          <View style={card.qaBlock}>
            <Text style={card.qaLabel}>AI Feedback</Text>
            <Text style={card.qaText}>{entry.feedback}</Text>
          </View>
          <View style={card.qaBlock}>
            <Text style={[card.qaLabel, { color: colors.accent.success }]}>Correct Answer</Text>
            <Text style={card.qaText}>{entry.correctAnswer}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Shared card styles ───────────────────────────────────────────────────────

const card = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  wrapOpen: { borderColor: colors.accent.primary },
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  body:     { flex: 1 },
  rightCol: { alignItems: 'flex-end', gap: spacing.xs },
  kindRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  kindBadge:{ borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  kindText: { fontSize: 9, fontWeight: typography.weights.black, letterSpacing: 0.8 },
  meta:     { fontSize: typography.scale.xs, color: colors.text.muted, textTransform: 'capitalize' },
  title:    { fontSize: typography.scale.base, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: 2 },
  date:     { fontSize: typography.scale.xs, color: colors.text.muted },

  // Expanded area
  expanded: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing.lg, gap: spacing.lg },
  qaBlock:  { gap: 4 },
  qaIdx:    { fontSize: typography.scale.xs, fontWeight: typography.weights.bold, color: colors.accent.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  qaQuestion:{ fontSize: typography.scale.sm, fontWeight: typography.weights.semibold, color: colors.text.primary, lineHeight: 20, marginBottom: 4 },
  qaLabel:  { fontSize: typography.scale.xs, fontWeight: typography.weights.semibold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  qaText:   { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20, flex: 1 },
  qaSkipped:{ fontSize: typography.scale.sm, color: colors.text.muted, fontStyle: 'italic' },
  noData:   { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md },
  viewBtn:  { alignSelf: 'flex-start', marginTop: spacing.xs },
  viewBtnText:{ fontSize: typography.scale.xs, color: colors.accent.primary, fontWeight: typography.weights.semibold },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'quiz',      label: 'Quiz' },
  { key: 'interview', label: 'Interview' },
  { key: 'daily',     label: 'Daily' },
];
const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'all',   label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
];

export default function SessionsScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<FeedItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sessRes, dqRes, ivRes] = await Promise.all([
        sessionsApi.list(),
        dailyQuestApi.history(500, 0),
        interviewApi.list(50, 0),
      ]);

      const quizItems: FeedItem[] = (Array.isArray(sessRes.data) ? sessRes.data : [])
        .map(s => ({ kind: 'quiz' as const, data: s, date: new Date(s.createdAt) }));

      const dailyItems: FeedItem[] = (dqRes.data.days ?? [])
        .flatMap(d => d.entries)
        .map(e => ({ kind: 'daily' as const, data: e, date: new Date(e.completedAt) }));

      const ivItems: FeedItem[] = (ivRes.data.sessions ?? [])
        .map(s => ({ kind: 'interview' as const, data: s, date: new Date(s.createdAt) }));

      setItems(
        [...quizItems, ...dailyItems, ...ivItems]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(true); };

  const visible = items.filter(item => {
    if (typeFilter !== 'all' && item.kind !== typeFilter)    return false;
    if (dateFilter === 'today' && !isToday(item.date))      return false;
    if (dateFilter === 'week'  && !isThisWeek(item.date))   return false;
    return true;
  });

  const emptyMsg =
    typeFilter === 'daily'     ? 'Complete daily quests to see them here.' :
    typeFilter === 'interview' ? 'Start an AI Interview to see sessions here.' :
                                 'Upload a document and start a quiz session.';

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
              <Text style={styles.subtitle}>Your complete activity history</Text>
            </View>
            <Pressable
              style={styles.newBtn}
              onPress={() => router.push('/(tabs)/upload')}
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

          {/* ── Single filter row ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {/* Type filters */}
            {TYPE_FILTERS.map(f => (
              <Pressable
                key={f.key}
                style={[styles.chip, typeFilter === f.key && styles.chipTypeActive]}
                onPress={() => setTypeFilter(f.key)}
              >
                <Text style={[styles.chipText, typeFilter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}

            {/* Divider */}
            <View style={styles.filterDivider} />

            {/* Date filters */}
            {DATE_FILTERS.map(f => (
              <Pressable
                key={f.key}
                style={[styles.chip, dateFilter === f.key && styles.chipDateActive]}
                onPress={() => setDateFilter(f.key)}
              >
                <Text style={[styles.chipText, dateFilter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Count */}
          {!loading && (
            <Text style={styles.countText}>
              {visible.length} {visible.length === 1 ? 'record' : 'records'}
            </Text>
          )}

          {/* List */}
          {loading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing['3xl'] }} />
          ) : visible.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="layers-outline" size={40} color={colors.text.muted} />
              </View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>{emptyMsg}</Text>
              {typeFilter !== 'daily' && typeFilter !== 'interview' && (
                <Pressable onPress={() => router.push('/(tabs)/upload')} style={styles.emptyBtn}>
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
            <View>
              {visible.map(item => {
                if (item.kind === 'quiz') return (
                  <QuizCard
                    key={`q-${item.data.id}`}
                    session={item.data}
                    onNavigate={() =>
                      item.data.status === 'completed'
                        ? router.push({ pathname: '/session/result', params: { id: item.data.id } })
                        : router.push(`/session/${item.data.id}`)
                    }
                  />
                );
                if (item.kind === 'interview') return (
                  <InterviewCard key={`i-${item.data._id}`} session={item.data} />
                );
                return (
                  <DailyCard key={`d-${item.data._id}`} entry={item.data} />
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  safeArea: { flex: 1 },
  orb1:     { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108,99,255,0.12)' },
  orb2:     { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168,85,247,0.08)' },
  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing['2xl'] },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  title:      { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle:   { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: 2 },
  newBtn:     { borderRadius: radius.full },
  newBtnGrad: { borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  newBtnText: { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },

  // Single filter row
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: screenPadding, paddingBottom: spacing.lg },
  chip:         { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border.default },
  chipTypeActive:{ backgroundColor: 'rgba(108,99,255,0.18)', borderColor: colors.accent.primary },
  chipDateActive:{ backgroundColor: 'rgba(168,85,247,0.18)', borderColor: '#A855F7' },
  chipText:     { fontSize: typography.scale.xs, color: colors.text.muted, fontWeight: typography.weights.medium },
  chipTextActive:{ color: colors.text.primary },
  filterDivider: { width: 1, height: 16, backgroundColor: colors.border.default, marginHorizontal: spacing.xs },

  countText: { fontSize: typography.scale.xs, color: colors.text.muted, marginBottom: spacing.md },

  empty:       { alignItems: 'center', paddingTop: spacing['3xl'], gap: spacing.lg },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg.surface, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:  { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary },
  emptyBody:   { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyBtn:    { borderRadius: radius.md },
  emptyBtnGrad:{ borderRadius: radius.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  emptyBtnText:{ color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },
});
