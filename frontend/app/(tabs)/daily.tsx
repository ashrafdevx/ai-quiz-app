import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  dailyQuestApi,
  type DailyQuestPlan,
  type DailyQuestQuestion,
  type DailyQuestSubmitResult,
} from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  easy:   { bg: 'rgba(16,185,129,0.15)',  text: colors.accent.success },
  medium: { bg: 'rgba(245,158,11,0.15)',  text: colors.accent.warning },
  hard:   { bg: 'rgba(239,68,68,0.15)',   text: colors.accent.danger },
};

function scoreColor(score: number) {
  if (score >= 80) return colors.accent.success;
  if (score >= 60) return colors.accent.warning;
  return colors.accent.danger;
}

function formatToday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

interface CardProps {
  q:          DailyQuestQuestion;
  index:      number;
  isActive:   boolean;
  result:     DailyQuestSubmitResult | null;
  inputValue: string;
  submitting: boolean;
  onToggle:   () => void;
  onInputChange: (text: string) => void;
  onSubmit:   () => void;
}

function QuestionCard({
  q, index, isActive, result, inputValue, submitting, onToggle, onInputChange, onSubmit,
}: CardProps) {
  const diffStyle  = DIFF_COLORS[q.difficulty] ?? DIFF_COLORS.medium;
  const isAnswered = !!result || (q.answered && !result);

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Card header — always visible */}
      <Pressable onPress={onToggle} style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.qNumBadge}>
            <Text style={styles.qNumText}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={[styles.diffBadge, { backgroundColor: diffStyle.bg }]}>
                <Text style={[styles.diffText, { color: diffStyle.text }]}>
                  {q.difficulty.toUpperCase()}
                </Text>
              </View>
              {q.topic ? (
                <Text style={styles.topicText} numberOfLines={1}>{q.topic}</Text>
              ) : null}
            </View>
            <Text style={styles.questionText} numberOfLines={isActive ? undefined : 2}>
              {q.question}
            </Text>
          </View>
        </View>

        {/* Right: status indicator */}
        <View style={styles.statusCol}>
          {result ? (
            <View style={[styles.scorePill, { backgroundColor: scoreColor(result.score) + '22' }]}>
              <Text style={[styles.scoreText, { color: scoreColor(result.score) }]}>
                {result.isCorrect ? '✓' : '✗'} {result.score}%
              </Text>
            </View>
          ) : q.answered ? (
            <Text style={styles.alreadyText}>✓ Done</Text>
          ) : (
            <Text style={styles.tapText}>{isActive ? '▲' : '▼'}</Text>
          )}
        </View>
      </Pressable>

      {/* Expanded: answer input or feedback */}
      {isActive && (
        <View style={styles.cardBody}>
          {result ? (
            // Show feedback after submission
            <FeedbackPanel result={result} />
          ) : q.answered && !result ? (
            // Answered in a prior app session — nudge to history
            <View style={styles.alreadyPanel}>
              <Text style={styles.alreadyPanelText}>
                You already answered this today. View full feedback in History.
              </Text>
            </View>
          ) : (
            // Answer input
            <AnswerInput
              value={inputValue}
              submitting={submitting}
              onChangeText={onInputChange}
              onSubmit={onSubmit}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── AnswerInput ───────────────────────────────────────────────────────────────

function AnswerInput({
  value, submitting, onChangeText, onSubmit,
}: {
  value: string; submitting: boolean; onChangeText: (t: string) => void; onSubmit: () => void;
}) {
  return (
    <View>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Type your answer here…"
        placeholderTextColor={colors.text.muted}
        value={value}
        onChangeText={onChangeText}
        textAlignVertical="top"
        scrollEnabled={false}
      />
      <Pressable
        onPress={onSubmit}
        disabled={submitting || !value.trim()}
        style={({ pressed }) => [styles.submitBtn, (submitting || !value.trim()) && styles.submitBtnDisabled, pressed && { opacity: 0.85 }]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <LinearGradient
            colors={['#6C63FF', '#A855F7']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.submitGrad}
          >
            <Text style={styles.submitText}>Submit Answer</Text>
          </LinearGradient>
        )}
      </Pressable>
    </View>
  );
}

// ── FeedbackPanel ─────────────────────────────────────────────────────────────

function FeedbackPanel({ result }: { result: DailyQuestSubmitResult }) {
  const color = scoreColor(result.score);
  return (
    <View style={styles.feedbackPanel}>
      {/* Score row */}
      <View style={[styles.scoreRow, { borderColor: color + '44' }]}>
        <Text style={[styles.scoreLarge, { color }]}>
          {result.isCorrect ? '✓' : '✗'} {result.score}%
        </Text>
        <Text style={[styles.verdictText, { color }]}>
          {result.isCorrect ? 'Correct' : 'Needs work'}
        </Text>
      </View>

      {/* AI feedback */}
      {!!result.feedback && (
        <Text style={styles.feedbackText}>{result.feedback}</Text>
      )}

      {/* Correct answer */}
      <View style={styles.answerBlock}>
        <Text style={styles.answerBlockLabel}>Correct Answer</Text>
        <Text style={styles.answerBlockText}>{result.correctAnswer}</Text>
      </View>

      {/* Tips */}
      {result.tips?.length > 0 && (
        <View style={styles.tipsBlock}>
          <Text style={styles.answerBlockLabel}>Key Points</Text>
          {result.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DailyQuestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan,       setPlan]       = useState<DailyQuestPlan | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeId,   setActiveId]   = useState<number | null>(null);
  const [inputs,     setInputs]     = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [results,    setResults]    = useState<Record<number, DailyQuestSubmitResult>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await dailyQuestApi.today();
      setPlan(data);
    } catch {
      Alert.alert('Error', 'Could not load today\'s quest. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    return () => {
      // reset active card when leaving so re-entry is clean
      setActiveId(null);
    };
  }, []));

  const handleToggle = (id: number) => {
    setActiveId(prev => (prev === id ? null : id));
  };

  const handleSubmit = async (q: DailyQuestQuestion) => {
    const answer = inputs[q.id]?.trim();
    if (!answer || !plan) return;

    setSubmitting(q.id);
    try {
      const { data } = await dailyQuestApi.submit(plan._id, q.id, answer);
      setResults(prev => ({ ...prev, [q.id]: data }));
      // Update plan's answered flag locally so status badge refreshes
      setPlan(prev =>
        prev
          ? {
              ...prev,
              questions: prev.questions.map(pq =>
                pq.id === q.id ? { ...pq, answered: true } : pq
              ),
            }
          : prev
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Submission failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(null);
    }
  };

  const answeredCount = plan
    ? plan.questions.filter(q => q.answered || results[q.id]).length
    : 0;
  const totalCount = plan?.questions.length ?? 5;

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Daily Quest</Text>
              <Text style={styles.dateLabel}>{formatToday()}</Text>
            </View>
            <Pressable onPress={() => router.push('/daily-quest/history')} style={styles.historyBtn}>
              <Text style={styles.historyBtnText}>History →</Text>
            </Pressable>
          </View>

          {/* Progress */}
          {!loading && plan && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(answeredCount / totalCount) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>{answeredCount}/{totalCount} answered</Text>
            </View>
          )}

          {/* Content */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent.primary} size="large" />
              <Text style={styles.loadingText}>Generating today's questions…</Text>
            </View>
          ) : plan ? (
            <View style={styles.list}>
              {plan.questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  index={i}
                  isActive={activeId === q.id}
                  result={results[q.id] ?? null}
                  inputValue={inputs[q.id] ?? ''}
                  submitting={submitting === q.id}
                  onToggle={() => handleToggle(q.id)}
                  onInputChange={text => setInputs(prev => ({ ...prev, [q.id]: text }))}
                  onSubmit={() => handleSubmit(q)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.errorText}>Failed to load. Tap to retry.</Text>
              <Pressable onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Completion callout */}
          {!loading && answeredCount === totalCount && totalCount > 0 && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedIcon}>🎉</Text>
              <Text style={styles.completedText}>All done for today! Come back tomorrow.</Text>
              <Pressable onPress={() => router.push('/daily-quest/history')}>
                <Text style={styles.completedLink}>View history →</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg:    { flex: 1 },
  orb1:  { position: 'absolute', top: -100, right: -80,  width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  orb2:  { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168, 85, 247, 0.08)' },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingBottom: 64 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  title:       { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  dateLabel:   { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: 2 },
  historyBtn:  { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  historyBtnText: { fontSize: typography.scale.sm, color: colors.accent.primary, fontWeight: typography.weights.medium },

  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.bg.raised, borderRadius: radius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: colors.accent.primary, borderRadius: radius.full },
  progressLabel: { fontSize: typography.scale.xs, color: colors.text.muted, minWidth: 70 },

  centered:    { alignItems: 'center', paddingTop: spacing['3xl'], gap: spacing.lg },
  loadingText: { color: colors.text.muted, fontSize: typography.scale.sm },
  errorText:   { color: colors.text.muted, fontSize: typography.scale.sm },
  retryBtn:    { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.bg.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default },
  retryText:   { color: colors.accent.primary, fontSize: typography.scale.sm, fontWeight: typography.weights.medium },

  list: { gap: spacing.md },

  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  cardActive: { borderColor: colors.accent.primary + '44' },

  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.lg, gap: spacing.md },
  cardHeaderLeft: { flex: 1, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },

  qNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bg.raised,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  qNumText: { fontSize: typography.scale.xs, fontWeight: typography.weights.bold, color: colors.text.secondary },

  badgeRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  diffBadge:  { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  diffText:   { fontSize: 9, fontWeight: typography.weights.bold, letterSpacing: 0.5 },
  topicText:  { fontSize: typography.scale.xs, color: colors.text.muted, flexShrink: 1 },
  questionText: { fontSize: typography.scale.sm, color: colors.text.primary, lineHeight: 20, fontWeight: typography.weights.medium },

  statusCol:    { alignItems: 'flex-end', paddingTop: 2 },
  scorePill:    { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  scoreText:    { fontSize: typography.scale.xs, fontWeight: typography.weights.bold },
  alreadyText:  { fontSize: typography.scale.xs, color: colors.accent.success },
  tapText:      { fontSize: 12, color: colors.text.muted },

  cardBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  // Answer input
  input: {
    backgroundColor: colors.bg.raised,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: typography.scale.sm,
    minHeight: 100,
    marginBottom: spacing.md,
  },
  submitBtn:         { borderRadius: radius.md, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.5 },
  submitGrad:        { paddingVertical: spacing.md, alignItems: 'center' },
  submitText:        { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },

  // Feedback panel
  feedbackPanel: { gap: spacing.md },
  scoreRow:      {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderRadius: radius.md, padding: spacing.md,
  },
  scoreLarge:    { fontSize: typography.scale.xl, fontWeight: typography.weights.bold },
  verdictText:   { fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },
  feedbackText:  { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  answerBlock: {
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)',
    padding: spacing.md, gap: spacing.xs,
  },
  answerBlockLabel: { fontSize: typography.scale.xs, fontWeight: typography.weights.bold, color: colors.accent.primary, letterSpacing: 0.5 },
  answerBlockText:  { fontSize: typography.scale.sm, color: colors.text.primary, lineHeight: 20 },

  tipsBlock: { gap: spacing.sm },
  tipRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent.primary, marginTop: 7 },
  tipText:   { flex: 1, fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  alreadyPanel: {
    backgroundColor: colors.bg.raised,
    borderRadius: radius.md, padding: spacing.md,
  },
  alreadyPanelText: { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center' },

  // Completion banner
  completedBanner: {
    marginTop: spacing.xl,
    backgroundColor: 'rgba(108,99,255,0.10)',
    borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)',
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  completedIcon: { fontSize: 36 },
  completedText: { fontSize: typography.scale.md, fontWeight: typography.weights.semibold, color: colors.text.primary, textAlign: 'center' },
  completedLink: { fontSize: typography.scale.sm, color: colors.accent.primary, fontWeight: typography.weights.medium },
});
