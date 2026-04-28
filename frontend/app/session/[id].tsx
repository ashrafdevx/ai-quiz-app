import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { sessionsApi, type Session, type Question } from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

// ── Badge helpers ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  technical:  { bg: 'rgba(56,189,248,0.15)',  text: colors.accent.info },
  behavioral: { bg: 'rgba(168,85,247,0.15)',  text: '#A855F7' },
  hr:         { bg: 'rgba(236,72,153,0.15)',  text: '#EC4899' },
  mixed:      { bg: 'rgba(108,99,255,0.15)',  text: colors.accent.primary },
};

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  junior: { bg: 'rgba(16,185,129,0.15)',  text: colors.accent.success },
  mid:    { bg: 'rgba(245,158,11,0.15)',  text: colors.accent.warning },
  senior: { bg: 'rgba(239,68,68,0.15)',   text: colors.accent.danger },
};

function Badge({ label, style }: { label: string; style: { bg: string; text: string } }) {
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeText, { color: style.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: total > 0 ? current / total : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

// ── Hint card ─────────────────────────────────────────────────────────────────

function HintCard({ hints }: { hints: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.hintWrapper}>
      <Pressable onPress={() => setOpen(v => !v)} style={styles.hintToggle}>
        <Text style={styles.hintToggleText}>{open ? '▲ Hide hint' : '💡 Show hint'}</Text>
      </Pressable>
      {open && (
        <View style={styles.hintBody}>
          {hints.map((h, i) => (
            <Text key={i} style={styles.hintItem}>• {h}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [session,  setSession]  = useState<Session | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [qIndex,   setQIndex]   = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await sessionsApi.get(id);
        setSession(data);
      } catch {
        Alert.alert('Error', 'Could not load session.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !session) {
    return (
      <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.centered}>
        <ActivityIndicator color={colors.accent.primary} size="large" />
      </LinearGradient>
    );
  }

  const questions = session.questions;
  const total     = questions.length;
  const q: Question = questions[qIndex];
  const isFirst = qIndex === 0;
  const isLast  = qIndex === total - 1;

  const handleComplete = async () => {
    Alert.alert(
      'Complete Session',
      'Mark this session as done and view your summary?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setCompleting(true);
            try {
              await sessionsApi.complete(id);
              router.replace('/(tabs)/sessions');
            } catch {
              Alert.alert('Error', 'Could not complete session.');
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const typeStyle = TYPE_COLORS[q.type]  ?? TYPE_COLORS.mixed;
  const diffStyle = DIFF_COLORS[q.difficulty] ?? DIFF_COLORS.mid;

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.questionCount}>Q {qIndex + 1} of {total}</Text>
        <ProgressBar current={qIndex + 1} total={total} />
        <Pressable onPress={() => router.back()} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕ Exit</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Document name */}
        <Text style={styles.docLabel} numberOfLines={1}>{session.documentName}</Text>

        {/* Badges */}
        <View style={styles.badges}>
          <Badge label={q.type}       style={typeStyle} />
          <Badge label={q.difficulty} style={diffStyle} />
        </View>

        {/* Question card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{q.text}</Text>
        </View>

        {/* Hint */}
        {q.hint?.length > 0 && <HintCard hints={q.hint} />}

        {/* Voice placeholder (Sprint 4) */}
        <View style={styles.voicePlaceholder}>
          <Text style={styles.voiceIcon}>🎙️</Text>
          <Text style={styles.voiceLabel}>Voice recording</Text>
          <Text style={styles.voiceSub}>Coming in Sprint 4</Text>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navBar}>
        <Pressable
          style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
          onPress={() => setQIndex(i => i - 1)}
          disabled={isFirst}
        >
          <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>← Prev</Text>
        </Pressable>

        {isLast ? (
          <Pressable
            onPress={handleComplete}
            disabled={completing}
            style={styles.completeBtn}
          >
            <LinearGradient
              colors={['#6C63FF', '#A855F7', '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.completeBtnGrad}
            >
              {completing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.completeBtnText}>Complete ✓</Text>
              }
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            style={styles.nextBtn}
            onPress={() => setQIndex(i => i + 1)}
          >
            <LinearGradient
              colors={['#6C63FF', '#A855F7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.nextBtnGrad}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb1:     { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  orb2:     { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168, 85, 247, 0.08)' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    paddingTop: 56,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  questionCount: { fontSize: typography.scale.sm, color: colors.text.muted, minWidth: 60 },
  exitBtn:       { paddingHorizontal: spacing.sm },
  exitText:      { fontSize: typography.scale.sm, color: colors.text.muted },

  progressTrack: { flex: 1, height: 4, backgroundColor: colors.bg.raised, borderRadius: radius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: colors.accent.primary, borderRadius: radius.full },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: spacing.lg, paddingBottom: 100 },

  docLabel: { fontSize: typography.scale.xs, color: colors.text.muted, marginBottom: spacing.lg },

  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  badge:  { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  badgeText: { fontSize: typography.scale.xs, fontWeight: typography.weights.bold, letterSpacing: 0.5 },

  questionCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  questionText: {
    fontSize: typography.scale.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    lineHeight: 30,
  },

  hintWrapper: { marginBottom: spacing.xl },
  hintToggle:  { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  hintToggleText: { fontSize: typography.scale.sm, color: colors.accent.primary, fontWeight: typography.weights.medium },
  hintBody:    {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  hintItem: { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },

  voicePlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  voiceIcon:  { fontSize: 40 },
  voiceLabel: { fontSize: typography.scale.md, fontWeight: typography.weights.semibold, color: colors.text.secondary },
  voiceSub:   { fontSize: typography.scale.sm, color: colors.text.muted },

  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.lg,
    paddingBottom: 28,
    backgroundColor: 'rgba(10,11,15,0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: spacing.md,
  },
  navBtn:            { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default },
  navBtnDisabled:    { borderColor: 'transparent', opacity: 0.3 },
  navBtnText:        { color: colors.text.secondary, fontSize: typography.scale.sm, fontWeight: typography.weights.medium },
  navBtnTextDisabled: { color: colors.text.muted },

  nextBtn:     { flex: 1 },
  nextBtnGrad: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },

  completeBtn:     { flex: 1 },
  completeBtnGrad: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },
});
