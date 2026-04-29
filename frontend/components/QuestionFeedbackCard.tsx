import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { VoiceAnswerResult } from '../services/api';

interface Props {
  result: VoiceAnswerResult;
}

export default function QuestionFeedbackCard({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { transcript, speechQuality, evaluation } = result;
  // Fall back gracefully if the response pre-dates Sprint 5
  const contentScore   = result.contentScore   ?? Math.round((evaluation.score ?? 5) * 10);
  const speechScore    = result.speechScore    ?? 70;
  const compositeScore = result.compositeScore ?? Math.round(contentScore * 0.70 + speechScore * 0.30);

  const scoreColor =
    compositeScore >= 80 ? colors.accent.success :
    compositeScore >= 55 ? colors.accent.warning :
    colors.accent.danger;

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <Pressable style={styles.header} onPress={() => setExpanded(v => !v)}>
        {/* Composite score circle */}
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{compositeScore}</Text>
          <Text style={styles.scoreDen}>/100</Text>
        </View>

        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Answer evaluated</Text>
          {/* Content / Speech sub-scores */}
          <View style={styles.subScoreRow}>
            <SubScorePill label="Content" value={contentScore} />
            <SubScorePill label="Speech"  value={speechScore}  />
          </View>
        </View>

        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* One-line AI verdict */}
          {evaluation.feedback ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Verdict</Text>
              <Text style={styles.verdictText}>{evaluation.feedback}</Text>
            </View>
          ) : null}

          {/* Transcript */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your transcript</Text>
            <Text style={styles.transcriptText}>{transcript || '(no speech detected)'}</Text>
          </View>

          {/* Speech metrics */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Speech metrics</Text>
            <View style={styles.metricsRow}>
              <MetricPill label="Words" value={String(speechQuality.wordCount)} />
              {speechQuality.wpm !== null && (
                <MetricPill
                  label="WPM"
                  value={String(speechQuality.wpm)}
                  warn={speechQuality.wpm < 80 || speechQuality.wpm > 200}
                />
              )}
              <MetricPill
                label="Fillers"
                value={String(speechQuality.fillerCount)}
                warn={speechQuality.fillerCount > 3}
              />
              <MetricPill label="Vocab %" value={`${speechQuality.uniqueWordRatio}%`} />
            </View>
            {speechQuality.fillerWords.length > 0 && (
              <Text style={styles.fillerNote}>
                Filler words: {speechQuality.fillerWords.join(', ')}
              </Text>
            )}
          </View>

          {/* Strengths */}
          {evaluation.strengths.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What you did well</Text>
              {evaluation.strengths.map((s, i) => (
                <Text key={i} style={styles.bulletGreen}>✓ {s}</Text>
              ))}
            </View>
          )}

          {/* Improvements */}
          {evaluation.improvements.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Areas to improve</Text>
              {evaluation.improvements.map((s, i) => (
                <Text key={i} style={styles.bulletAmber}>→ {s}</Text>
              ))}
            </View>
          )}

          {/* Ideal answer */}
          {evaluation.improvedAnswer ? (
            <View style={styles.idealBox}>
              <Text style={styles.idealLabel}>Model answer</Text>
              <Text style={styles.idealText}>{evaluation.improvedAnswer}</Text>
            </View>
          ) : evaluation.suggestedPhrase ? (
            <View style={styles.phraseBox}>
              <Text style={styles.phraseLabel}>Try phrasing it as:</Text>
              <Text style={styles.phraseText}>"{evaluation.suggestedPhrase}"</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubScorePill({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? colors.accent.success :
    value >= 55 ? colors.accent.warning :
    colors.accent.danger;
  return (
    <View style={[styles.subPill, { borderColor: color }]}>
      <Text style={[styles.subPillValue, { color }]}>{value}</Text>
      <Text style={styles.subPillLabel}>{label}</Text>
    </View>
  );
}

function MetricPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.pill, warn && styles.pillWarn]}>
      <Text style={[styles.pillValue, warn && styles.pillValueWarn]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },

  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: colors.bg.raised,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
  },
  scoreNum: {
    fontSize: typography.scale.xl,
    fontWeight: typography.weights.bold,
  },
  scoreDen: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    marginTop: 4,
  },

  headerMeta: { flex: 1 },
  headerTitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  subScoreRow: { flexDirection: 'row', gap: spacing.sm },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  subPillValue: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weights.bold,
  },
  subPillLabel: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
  },

  chevron: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
  },

  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    padding: spacing.lg,
    gap: spacing.lg,
  },

  section: { gap: spacing.sm },
  sectionLabel: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  verdictText: {
    fontSize: typography.scale.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  transcriptText: {
    fontSize: typography.scale.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    backgroundColor: colors.bg.raised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 60,
  },
  pillWarn: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  pillValue: {
    fontSize: typography.scale.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  pillValueWarn: {
    color: colors.accent.warning,
  },
  pillLabel: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
  },
  fillerNote: {
    fontSize: typography.scale.xs,
    color: colors.accent.warning,
  },

  bulletGreen: {
    fontSize: typography.scale.sm,
    color: colors.accent.success,
    lineHeight: 20,
  },
  bulletAmber: {
    fontSize: typography.scale.sm,
    color: colors.accent.warning,
    lineHeight: 20,
  },

  idealBox: {
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.success,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  idealLabel: {
    fontSize: typography.scale.xs,
    color: colors.accent.success,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  idealText: {
    fontSize: typography.scale.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },

  phraseBox: {
    backgroundColor: 'rgba(108,99,255,0.08)',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.primary,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  phraseLabel: {
    fontSize: typography.scale.xs,
    color: colors.accent.primary,
    fontWeight: typography.weights.semibold,
  },
  phraseText: {
    fontSize: typography.scale.sm,
    color: colors.text.primary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
