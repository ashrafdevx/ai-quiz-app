import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { documentsApi, questionsApi, sessionsApi, type Document } from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

const COUNTS      = [3, 5, 7, 10];
const TYPES       = ['mixed', 'technical', 'behavioral', 'hr'] as const;
const DIFFICULTIES = ['junior', 'mid', 'senior'] as const;

type QuizType       = typeof TYPES[number];
type QuizDifficulty = typeof DIFFICULTIES[number];

function Chip<T extends string>({
  value, selected, onPress, label,
}: { value: T; selected: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label ?? value}
      </Text>
    </Pressable>
  );
}

export default function NewSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ docId?: string; docName?: string }>();

  const [docs,        setDocs]        = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [count,       setCount]       = useState(5);
  const [type,        setType]        = useState<QuizType>('mixed');
  const [difficulty,  setDifficulty]  = useState<QuizDifficulty>('mid');
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [generating,  setGenerating]  = useState(false);
  const [step,        setStep]        = useState<'generating' | 'creating' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await documentsApi.list();
        const ready = data.documents.filter(d => d.status === 'ready');
        setDocs(ready);

        // Pre-select if docId was passed from upload screen
        if (params.docId) {
          const pre = ready.find(d => d._id === params.docId);
          if (pre) setSelectedDoc(pre);
        } else if (ready.length === 1) {
          setSelectedDoc(ready[0]);
        }
      } catch {
        // silent
      } finally {
        setLoadingDocs(false);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    if (!selectedDoc) {
      Alert.alert('Select a document', 'Please choose a document to generate questions from.');
      return;
    }

    setGenerating(true);
    try {
      // 1. Fetch full document text
      setStep('generating');
      const { data: docData } = await documentsApi.get(selectedDoc._id);
      const text = docData.document.text ?? '';

      if (!text || text.length < 50) {
        Alert.alert('Document error', 'This document has no extractable text.');
        return;
      }

      // 2. Generate questions
      const { data: qData } = await questionsApi.generate({ text, count, type, difficulty });

      // 3. Create session
      setStep('creating');
      const { data: session } = await sessionsApi.create({
        documentName:  selectedDoc.fileName,
        extractedText: text,
        questions:     qData.questions,
        interviewType: type,
        difficulty,
      });

      // 4. Navigate to question viewer
      router.replace(`/session/${session.id}`);
    } catch (err: any) {
      Alert.alert('Generation failed', err?.response?.data?.message ?? err?.response?.data?.error ?? 'Something went wrong.');
    } finally {
      setGenerating(false);
      setStep(null);
    }
  };

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>New Session</Text>
          <Text style={styles.subtitle}>Choose a document and configure your quiz</Text>
        </View>

        {/* Document picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Document</Text>
          {loadingDocs ? (
            <ActivityIndicator color={colors.accent.primary} />
          ) : docs.length === 0 ? (
            <View style={styles.noDocs}>
              <Text style={styles.noDocsText}>No ready documents. Upload a PDF first.</Text>
              <Pressable onPress={() => router.replace('/(tabs)/upload')}>
                <Text style={styles.noDocsLink}>Go to Upload →</Text>
              </Pressable>
            </View>
          ) : (
            docs.map(doc => (
              <Pressable
                key={doc._id}
                onPress={() => setSelectedDoc(doc)}
                style={[styles.docCard, selectedDoc?._id === doc._id && styles.docCardSelected]}
              >
                <Text style={styles.docIcon}>📄</Text>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
                  <Text style={styles.docMeta}>{doc.wordCount?.toLocaleString()} words</Text>
                </View>
                {selectedDoc?._id === doc._id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            ))
          )}
        </View>

        {/* Question count */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Questions</Text>
          <View style={styles.chips}>
            {COUNTS.map(n => (
              <Chip key={n} value={String(n) as any} selected={count === n} onPress={() => setCount(n)} />
            ))}
          </View>
        </View>

        {/* Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.chips}>
            {TYPES.map(t => (
              <Chip key={t} value={t} selected={type === t} onPress={() => setType(t)} />
            ))}
          </View>
        </View>

        {/* Difficulty */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Level</Text>
          <View style={styles.chips}>
            {DIFFICULTIES.map(d => (
              <Chip key={d} value={d} selected={difficulty === d} onPress={() => setDifficulty(d)} />
            ))}
          </View>
        </View>

        {/* Generate button */}
        <Pressable
          onPress={handleGenerate}
          disabled={generating || !selectedDoc}
          style={({ pressed }) => [styles.genBtn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient
            colors={generating || !selectedDoc ? ['#1A1E29', '#1A1E29'] : ['#6C63FF', '#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.genBtnGrad}
          >
            {generating ? (
              <View style={styles.genLoading}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.genBtnText}>
                  {step === 'creating' ? 'Creating session…' : 'Generating questions…'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.genBtnText, !selectedDoc && { color: colors.text.muted }]}>
                Generate {count} Questions →
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  orb1:     { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108, 99, 255, 0.12)' },
  orb2:     { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168, 85, 247, 0.08)' },
  scroll:   { flex: 1 },
  container: { paddingHorizontal: screenPadding },

  header:   { marginBottom: spacing['2xl'] },
  backBtn:  { marginBottom: spacing.md },
  backText: { color: colors.accent.primary, fontSize: typography.scale.sm },
  title:    { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: spacing.xs },

  section:      { marginBottom: spacing['2xl'] },
  sectionLabel: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  docCardSelected: { borderColor: colors.accent.primary, backgroundColor: 'rgba(108, 99, 255, 0.08)' },
  docIcon:  { fontSize: 22, marginRight: spacing.md },
  docInfo:  { flex: 1 },
  docName:  { fontSize: typography.scale.base, color: colors.text.primary, fontWeight: typography.weights.medium },
  docMeta:  { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: 2 },
  checkmark: { fontSize: 16, color: colors.accent.primary, fontWeight: typography.weights.bold },

  noDocs:     { alignItems: 'center', padding: spacing.xl },
  noDocsText: { color: colors.text.secondary, fontSize: typography.scale.sm, marginBottom: spacing.md },
  noDocsLink: { color: colors.accent.primary, fontSize: typography.scale.sm, fontWeight: typography.weights.semibold },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  chipSelected: { borderColor: colors.accent.primary, backgroundColor: 'rgba(108, 99, 255, 0.15)' },
  chipText:     { fontSize: typography.scale.sm, color: colors.text.secondary, textTransform: 'capitalize' },
  chipTextSelected: { color: colors.accent.primary, fontWeight: typography.weights.semibold },

  genBtn:     { marginTop: spacing.md },
  genBtnGrad: { borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center' },
  genBtnText: { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.semibold },
  genLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
