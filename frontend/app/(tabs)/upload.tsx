import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { documentsApi, type Document, extractMessage } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

export default function UploadScreen() {
  const router = useRouter();

  const [freshDoc,     setFreshDoc]     = useState<Document | null>(null);
  const [prevDocs,     setPrevDocs]     = useState<Document[]>([]);
  const [selectedDoc,  setSelectedDoc]  = useState<Document | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [fetching,     setFetching]     = useState(true);
  const [prevExpanded, setPrevExpanded] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const loadPrevDocs = useCallback(async (excludeId?: string) => {
    try {
      const { data } = await documentsApi.list();
      const ready = data.documents.filter(
        d => d.status === 'ready' && d._id !== excludeId
      );
      setPrevDocs(ready);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadPrevDocs(freshDoc?._id);
  }, [freshDoc?._id]));

  useEffect(() => {
    if (uploading) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [uploading]);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const cleanName = (() => {
        try { return decodeURIComponent(file.name); }
        catch { return file.name; }
      })();

      setUploading(true);

      const formData = new FormData();
      formData.append('document', {
        uri:  file.uri,
        name: cleanName,
        type: file.mimeType ?? 'application/octet-stream',
      } as any);

      const { data: uploaded } = await documentsApi.upload(formData);

      const fresh: Document = {
        _id:       uploaded.documentId,
        fileName:  uploaded.fileName,
        wordCount: uploaded.wordCount,
        charCount: uploaded.charCount,
        status:    'ready',
        createdAt: new Date().toISOString(),
      };

      setFreshDoc(fresh);
      setSelectedDoc(fresh);
      await loadPrevDocs(fresh._id);
    } catch (err: any) {
      Alert.alert('Upload failed', extractMessage(err, 'Could not upload the file. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = (doc: Document) => {
    Alert.alert(
      'Delete document?',
      `"${doc.fileName}" will be removed. Your existing quiz sessions are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await documentsApi.delete(doc._id);
              setPrevDocs(prev => prev.filter(d => d._id !== doc._id));
              if (selectedDoc?._id === doc._id) setSelectedDoc(freshDoc ?? null);
            } catch (err: any) {
              Alert.alert('Delete failed', extractMessage(err, 'Could not delete the document.'));
            }
          },
        },
      ]
    );
  };

  const handleGenerate = () => {
    const doc = selectedDoc ?? freshDoc;
    if (!doc) return;
    router.push({ pathname: '/session/new', params: { docId: doc._id } });
  };

  const canGenerate = !!(selectedDoc ?? freshDoc);

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Upload Document</Text>
            <Text style={styles.subtitle}>Add study material to generate quiz questions</Text>
          </View>

          {/* Upload zone */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              style={[styles.dropzone, uploading && styles.dropzoneActive]}
              onPress={handlePick}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.dropzoneText}>Processing document…</Text>
                  <Text style={styles.dropzoneHint}>This may take up to 30 seconds</Text>
                </>
              ) : freshDoc ? (
                <>
                  <Text style={styles.uploadIcon}>✓</Text>
                  <Text style={[styles.dropzoneText, { color: colors.accent.success }]}>Upload complete</Text>
                  <Text style={styles.dropzoneHint}>Tap to replace with a different file</Text>
                </>
              ) : (
                <>
                  <Text style={styles.uploadIcon}>☁</Text>
                  <Text style={styles.dropzoneText}>Tap to browse files</Text>
                  <Text style={styles.dropzoneHint}>PDF · DOCX · TXT · max 10 MB</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Audio input option */}
          {!uploading && (
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
          )}
          {!uploading && (
            <Pressable
              style={styles.audioBtn}
              onPress={() => router.push('/audio-record')}
            >
              <View style={styles.audioBtnIcon}>
                <Ionicons name="mic" size={20} color="#A855F7" />
              </View>
              <View style={styles.audioBtnText}>
                <Text style={styles.audioBtnTitle}>Record Audio</Text>
                <Text style={styles.audioBtnHint}>Speak your notes — we'll transcribe them</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </Pressable>
          )}

          {/* Freshly uploaded doc */}
          {freshDoc && (
            <View style={styles.freshSection}>
              <Text style={styles.sectionLabel}>Ready to quiz</Text>
              <Pressable
                style={[styles.docCard, styles.docCardSelected]}
                onPress={() => setSelectedDoc(freshDoc)}
              >
                <Text style={styles.docEmoji}>📄</Text>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{freshDoc.fileName}</Text>
                  <Text style={styles.docMeta}>{freshDoc.wordCount.toLocaleString()} words</Text>
                </View>
                <Text style={[styles.statusIcon, { color: colors.accent.success }]}>✓</Text>
              </Pressable>
            </View>
          )}

          {/* Previous documents */}
          {!fetching && prevDocs.length > 0 && (
            <View style={styles.prevSection}>
              <Pressable style={styles.prevHeader} onPress={() => setPrevExpanded(v => !v)}>
                <Text style={styles.sectionLabel}>Previous documents ({prevDocs.length})</Text>
                <Text style={styles.chevron}>{prevExpanded ? '▲' : '▼'}</Text>
              </Pressable>

              {prevExpanded && prevDocs.map(doc => (
                <View key={doc._id} style={styles.docRow}>
                  <Pressable
                    style={[styles.docCard, styles.docCardFlex, selectedDoc?._id === doc._id && styles.docCardSelected]}
                    onPress={() => setSelectedDoc(prev => prev?._id === doc._id ? (freshDoc ?? null) : doc)}
                  >
                    <Text style={styles.docEmoji}>📄</Text>
                    <View style={styles.docInfo}>
                      <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
                      <Text style={styles.docMeta}>{doc.wordCount.toLocaleString()} words</Text>
                    </View>
                    {selectedDoc?._id === doc._id && (
                      <Text style={[styles.statusIcon, { color: colors.accent.primary }]}>✓</Text>
                    )}
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => handleDeleteDoc(doc)}>
                    <Ionicons name="trash-outline" size={18} color={colors.accent.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* CTA */}
          <View style={styles.ctaWrapper}>
            <Pressable
              onPress={handleGenerate}
              disabled={!canGenerate}
              style={({ pressed }) => [pressed && canGenerate && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={canGenerate ? ['#6C63FF', '#A855F7', '#EC4899'] : ['#1A1E29', '#1A1E29', '#1A1E29']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btn}
              >
                <Text style={[styles.btnText, !canGenerate && styles.btnTextMuted]}>
                  {canGenerate
                    ? `Generate from "${(selectedDoc ?? freshDoc)!.fileName.length > 24
                        ? (selectedDoc ?? freshDoc)!.fileName.slice(0, 24) + '…'
                        : (selectedDoc ?? freshDoc)!.fileName}" →`
                    : 'Upload a document to continue'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:       { flex: 1 },
  safeArea: { flex: 1 },
  orb1:     { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108,99,255,0.12)' },
  orb2:     { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168,85,247,0.08)' },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing['2xl'] },

  header:   { marginBottom: spacing['2xl'] },
  title:    { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: spacing.xs },

  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border.default },
  orText: { marginHorizontal: spacing.md, fontSize: typography.scale.xs, color: colors.text.muted },
  audioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.30)',
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  audioBtnIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  audioBtnText: { flex: 1 },
  audioBtnTitle: { fontSize: typography.scale.base, fontWeight: typography.weights.semibold, color: colors.text.primary },
  audioBtnHint: { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: 2 },

  dropzone: {
    borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.border.strong,
    borderRadius: radius.xl,
    paddingVertical: 48,
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: spacing.xs,
  },
  dropzoneActive: { borderColor: colors.accent.primary },
  uploadIcon:     { fontSize: 44, marginBottom: spacing.sm },
  dropzoneText:   { fontSize: typography.scale.md, color: colors.text.secondary, fontWeight: typography.weights.medium },
  dropzoneHint:   { fontSize: typography.scale.sm, color: colors.text.muted },

  sectionLabel: {
    fontSize: typography.scale.xs, fontWeight: typography.weights.semibold,
    color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: spacing.md,
  },

  freshSection: { marginBottom: spacing['2xl'] },
  prevSection:  { marginBottom: spacing['2xl'] },
  prevHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  chevron:      { fontSize: typography.scale.xs, color: colors.text.muted },

  docRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  docCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg, marginBottom: spacing.sm,
  },
  docCardFlex:     { flex: 1, marginBottom: 0 },
  docCardSelected: { borderColor: colors.accent.primary, backgroundColor: 'rgba(108,99,255,0.08)' },
  deleteBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  docEmoji:   { fontSize: 22, marginRight: spacing.md },
  docInfo:    { flex: 1 },
  docName:    { fontSize: typography.scale.base, color: colors.text.primary, fontWeight: typography.weights.medium },
  docMeta:    { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: 2 },
  statusIcon: { fontSize: 18, fontWeight: typography.weights.bold },

  ctaWrapper: { marginTop: spacing.sm },
  btn:        { borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center' },
  btnText:    { color: '#fff', fontSize: typography.scale.sm, fontWeight: typography.weights.semibold, textAlign: 'center' },
  btnTextMuted: { color: colors.text.muted, fontSize: typography.scale.base },
});
