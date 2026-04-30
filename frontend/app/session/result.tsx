import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { feedbackApi, sessionsApi, type FeedbackResult, type Session } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors, getScoreColor } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

// ── Dimension bar ─────────────────────────────────────────────────────────────

function DimensionBar({ label, score }: { label: string; score: number }) {
  const pct = `${Math.round((score / 10) * 100)}%`;
  const barColor = score >= 8 ? colors.accent.success : score >= 5 ? colors.accent.warning : colors.accent.danger;

  return (
    <View style={styles.dimRow}>
      <Text style={styles.dimLabel}>{label}</Text>
      <View style={styles.dimTrack}>
        <View style={[styles.dimFill, { width: pct as any, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.dimScore, { color: barColor }]}>{score}/10</Text>
    </View>
  );
}

// ── Score breakdown bar (content vs speech proxy) ────────────────────────────

function ScoreBreakdownCard({ dimensions }: { dimensions: FeedbackResult['dimensions'] }) {
  // Relevance proxies content quality; clarity + confidence + grammar + vocab proxy speech delivery
  const contentProxy = Math.round(dimensions.relevance * 10);
  const speechProxy  = Math.round(
    ((dimensions.clarity + dimensions.confidence + dimensions.grammar + dimensions.vocabulary) / 4) * 10,
  );
  const composite = Math.round(contentProxy * 0.70 + speechProxy * 0.30);

  const contentColor = contentProxy >= 80 ? colors.accent.success : contentProxy >= 55 ? colors.accent.warning : colors.accent.danger;
  const speechColor  = speechProxy  >= 80 ? colors.accent.success : speechProxy  >= 55 ? colors.accent.warning : colors.accent.danger;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Score breakdown</Text>
      <Text style={styles.breakdownFormula}>Composite = Content × 70% + Speech × 30%</Text>

      <View style={styles.breakdownRow}>
        <BreakdownBlock label="Content" value={contentProxy} color={contentColor} />
        <Text style={styles.breakdownOp}>×0.7 +</Text>
        <BreakdownBlock label="Speech"  value={speechProxy}  color={speechColor}  />
        <Text style={styles.breakdownOp}>×0.3 =</Text>
        <BreakdownBlock label="Score"   value={composite}    color={getScoreColor(composite)} bold />
      </View>
    </View>
  );
}

function BreakdownBlock({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <View style={styles.breakdownBlock}>
      <Text style={[styles.breakdownValue, { color }, bold && styles.breakdownValueBold]}>{value}</Text>
      <Text style={styles.breakdownLabel}>{label}</Text>
    </View>
  );
}

// ── Question row ──────────────────────────────────────────────────────────────

function QuestionRow({
  index,
  question,
  entry,
}: {
  index: number;
  question: { text: string };
  entry: FeedbackResult['questions'][number];
}) {
  const [open, setOpen] = useState(false);
  const scoreColor = entry.score >= 8 ? colors.accent.success : entry.score >= 5 ? colors.accent.warning : colors.accent.danger;

  return (
    <View style={styles.qCard}>
      <Pressable style={styles.qHeader} onPress={() => setOpen(v => !v)}>
        <View style={[styles.qScore, { borderColor: scoreColor }]}>
          <Text style={[styles.qScoreNum, { color: scoreColor }]}>{entry.score}</Text>
        </View>
        <Text style={styles.qText} numberOfLines={open ? undefined : 2}>
          Q{index + 1}: {question.text}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {open && (
        <View style={styles.qBody}>
          {entry.strengths.map((s, i) => (
            <Text key={i} style={styles.bulletGreen}>✓ {s}</Text>
          ))}
          {entry.improvements.map((s, i) => (
            <Text key={i} style={styles.bulletAmber}>→ {s}</Text>
          ))}
          {entry.suggestedPhrase ? (
            <View style={styles.phraseBox}>
              <Text style={styles.phraseLabel}>Suggested phrasing:</Text>
              <Text style={styles.phraseText}>"{entry.suggestedPhrase}"</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshUser } = useAuthStore();

  const [session,      setSession]      = useState<Session | null>(null);
  const [feedback,     setFeedback]     = useState<FeedbackResult | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [displayScore, setDisplayScore] = useState(0);

  // Ring entrance animation
  const ringScale   = useRef(new Animated.Value(0.75)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await sessionsApi.get(id);
        setSession(sess);

        const { data: fb } = sess.feedback
          ? { data: sess.feedback }
          : await feedbackApi.generate(id);
        setFeedback(fb);

        // Refresh home screen stats after session is scored
        refreshUser();
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? 'Could not load results.';
        setError(msg);
        Alert.alert('Error', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Animate score ring + count up number when feedback arrives
  useEffect(() => {
    if (!feedback) return;

    Animated.parallel([
      Animated.spring(ringScale,   { toValue: 1, useNativeDriver: true, tension: 55, friction: 8 }),
      Animated.timing(ringOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const target = feedback.overall;
    const steps  = 50;
    const delay  = 900 / steps; // ~900ms total
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplayScore(Math.round((step / steps) * target));
      if (step >= steps) clearInterval(timer);
    }, delay);

    return () => clearInterval(timer);
  }, [feedback?.overall]);

  if (loading) {
    return (
      <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
        <Text style={styles.loadingText}>Generating your feedback…</Text>
      </LinearGradient>
    );
  }

  if (error || !feedback || !session) {
    return (
      <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
        <Pressable onPress={() => router.replace('/(tabs)/sessions')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back to Sessions</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const scoreColor = getScoreColor(feedback.overall);

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Overall score hero ── */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{session.documentName}</Text>

          <Animated.View style={[styles.scoreRingWrap, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}>
            <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
              <Text style={[styles.scoreNum, { color: scoreColor }]}>{displayScore}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
          </Animated.View>

          <Text style={[styles.gradeText, { color: scoreColor }]}>{feedback.grade}</Text>
          <Text style={styles.summaryText}>{feedback.summary}</Text>
        </View>

        {/* ── Score breakdown ── */}
        <ScoreBreakdownCard dimensions={feedback.dimensions} />

        {/* ── Communication dimensions ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Communication breakdown</Text>
          <DimensionBar label="Clarity"     score={feedback.dimensions.clarity} />
          <DimensionBar label="Confidence"  score={feedback.dimensions.confidence} />
          <DimensionBar label="Relevance"   score={feedback.dimensions.relevance} />
          <DimensionBar label="Grammar"     score={feedback.dimensions.grammar} />
          <DimensionBar label="Vocabulary"  score={feedback.dimensions.vocabulary} />
        </View>

        {/* ── Per-question breakdown ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Question breakdown</Text>
          {feedback.questions.map((entry, i) => (
            <QuestionRow
              key={entry.id}
              index={i}
              question={session.questions[i] ?? { text: `Question ${i + 1}` }}
              entry={entry}
            />
          ))}
        </View>

        {/* ── Top tips ── */}
        {feedback.topTips?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top tips for next time</Text>
            {feedback.topTips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipNum}>{i + 1}</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── CTA ── */}
        <Pressable
          onPress={() => router.replace('/(tabs)/sessions')}
          style={styles.doneBtn}
        >
          <LinearGradient
            colors={['#6C63FF', '#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.doneBtnGrad}
          >
            <Text style={styles.doneBtnText}>Back to Sessions</Text>
          </LinearGradient>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: screenPadding },
  orb1:     { position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(108,99,255,0.1)' },
  orb2:     { position: 'absolute', bottom: 60, left: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(168,85,247,0.07)' },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, gap: spacing['2xl'] },

  loadingText: { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: spacing.md },
  errorText:   { fontSize: typography.scale.md, color: colors.accent.danger, textAlign: 'center' },

  backBtn:     { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  backBtnText: { color: colors.text.secondary, fontSize: typography.scale.sm },

  // Hero
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroLabel: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    textAlign: 'center',
  },
  scoreRingWrap: {
    // wrapper for animated transform (scale + opacity)
  },
  scoreRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    flexDirection: 'row',
    gap: 2,
  },
  scoreNum: {
    fontSize: 44,
    fontWeight: typography.weights.bold,
  },
  scoreMax: {
    fontSize: typography.scale.sm,
    color: colors.text.muted,
    marginTop: 18,
  },
  gradeText: {
    fontSize: typography.scale['2xl'],
    fontWeight: typography.weights.bold,
  },
  summaryText: {
    fontSize: typography.scale.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },

  // Card
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },

  // Score breakdown
  breakdownFormula: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    marginTop: -spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  breakdownBlock: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownValue: {
    fontSize: typography.scale.xl,
    fontWeight: typography.weights.bold,
  },
  breakdownValueBold: {
    fontSize: typography.scale['2xl'],
  },
  breakdownLabel: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  breakdownOp: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    paddingHorizontal: 2,
  },

  // Dimensions
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dimLabel: {
    width: 80,
    fontSize: typography.scale.xs,
    color: colors.text.secondary,
  },
  dimTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bg.raised,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  dimFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  dimScore: {
    width: 36,
    fontSize: typography.scale.xs,
    fontWeight: typography.weights.semibold,
    textAlign: 'right',
  },

  // Section
  section: { gap: spacing.md },
  sectionTitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },

  // Question cards
  qCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    gap: spacing.md,
  },
  qScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qScoreNum: {
    fontSize: typography.scale.md,
    fontWeight: typography.weights.bold,
  },
  qText: {
    flex: 1,
    fontSize: typography.scale.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  chevron: { fontSize: typography.scale.xs, color: colors.text.muted, paddingTop: 2 },

  qBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bulletGreen: { fontSize: typography.scale.sm, color: colors.accent.success, lineHeight: 20 },
  bulletAmber: { fontSize: typography.scale.sm, color: colors.accent.warning, lineHeight: 20 },

  phraseBox: {
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  phraseLabel: { fontSize: typography.scale.xs, color: colors.accent.primary, fontWeight: typography.weights.semibold },
  phraseText:  { fontSize: typography.scale.sm, color: colors.text.primary, fontStyle: 'italic' },

  // Tips
  tipRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tipNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(108,99,255,0.15)',
    color: colors.accent.primary,
    fontSize: typography.scale.xs,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    lineHeight: 24,
  },
  tipText: { flex: 1, fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  // Done button
  doneBtn:     { marginTop: spacing.md },
  doneBtnGrad: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.semibold },
});
