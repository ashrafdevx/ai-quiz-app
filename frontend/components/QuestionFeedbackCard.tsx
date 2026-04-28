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

  const scoreColor =
    evaluation.score >= 8 ? colors.accent.success :
    evaluation.score >= 5 ? colors.accent.warning :
    colors.accent.danger;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <Pressable style={styles.header} onPress={() => setExpanded(v => !v)}>
        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{evaluation.score}</Text>
          <Text style={styles.scoreDen}>/10</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Answer evaluated</Text>
          <Text style={styles.headerSub} numberOfLines={2}>{transcript}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* Transcript */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your transcript</Text>
            <Text style={styles.transcriptText}>{transcript || '(no speech detected)'}</Text>
          </View>

          {/* Speech quality */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Speech metrics</Text>
            <View style={styles.metricsRow}>
              <MetricPill label="Words" value={String(speechQuality.wordCount)} />
              {speechQuality.wpm !== null && (
                <MetricPill label="WPM" value={String(speechQuality.wpm)} />
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
                Filler words used: {speechQuality.fillerWords.join(', ')}
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

          {/* Suggested phrase */}
          {evaluation.suggestedPhrase && (
            <View style={styles.phraseBox}>
              <Text style={styles.phraseLabel}>Try phrasing it as:</Text>
              <Text style={styles.phraseText}>"{evaluation.suggestedPhrase}"</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function MetricPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.pill, warn && styles.pillWarn]}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

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
    width: 52,
    height: 52,
    borderRadius: 26,
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

  headerText: { flex: 1 },
  headerTitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: typography.scale.xs,
    color: colors.text.muted,
    lineHeight: 16,
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
