import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { sessionsApi, type Session } from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function ScoreBadge({ score, status }: { score: number; status: Session['status'] }) {
  if (status === 'in_progress') {
    return <View style={[styles.badge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
      <Text style={[styles.badgeText, { color: colors.accent.info }]}>In Progress</Text>
    </View>;
  }
  const color = score >= 80 ? colors.accent.success : score >= 50 ? colors.accent.warning : colors.accent.danger;
  const bg    = score >= 80 ? 'rgba(16,185,129,0.15)' : score >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{score}%</Text>
    </View>
  );
}

function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardIcon}>📄</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{session.documentName}</Text>
          <Text style={styles.cardMeta}>
            {session.questions.length} questions · {session.interviewType} · {session.difficulty}
          </Text>
          <Text style={styles.cardDate}>{formatDate(session.createdAt)}</Text>
        </View>
        <ScoreBadge score={session.score} status={session.status} />
      </View>
    </Pressable>
  );
}

export default function SessionsScreen() {
  const router   = useRouter();
  const [sessions,  setSessions]  = useState<Session[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await sessionsApi.list();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload every time this tab comes into focus
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(true); };

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

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
            <Text style={styles.subtitle}>Your quiz history</Text>
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

        {/* Content */}
        {loading ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing['3xl'] }} />
        ) : sessions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyBody}>Upload a document and start your first quiz session.</Text>
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
          </View>
        ) : (
          <View style={styles.list}>
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                onPress={() => router.push(`/session/${s.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  orb1:     { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  orb2:     { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168, 85, 247, 0.08)' },
  scroll:   { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: 60, paddingBottom: 48 },

  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2xl'] },
  title:    { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: 2 },

  newBtn:     { borderRadius: radius.full },
  newBtnGrad: { borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  newBtnText: { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },

  list: { gap: spacing.md },

  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { fontSize: 28, marginRight: spacing.md },
  cardBody: { flex: 1 },
  cardName: { fontSize: typography.scale.base, fontWeight: typography.weights.semibold, color: colors.text.primary },
  cardMeta: { fontSize: typography.scale.xs, color: colors.text.secondary, marginTop: 2, textTransform: 'capitalize' },
  cardDate: { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: 2 },

  badge:     { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, marginLeft: spacing.sm },
  badgeText: { fontSize: typography.scale.xs, fontWeight: typography.weights.bold },

  empty:        { alignItems: 'center', paddingTop: spacing['3xl'] },
  emptyIcon:    { fontSize: 56, marginBottom: spacing.lg },
  emptyTitle:   { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyBody:    { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', marginBottom: spacing['2xl'], paddingHorizontal: spacing.xl },
  emptyBtn:     { borderRadius: radius.md },
  emptyBtnGrad: { borderRadius: radius.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md },
  emptyBtnText: { color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },
});
