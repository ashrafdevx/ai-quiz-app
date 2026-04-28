import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { documentsApi, type Document } from '../../services/api';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius, screenPadding } from '../../constants/spacing';

export default function UploadScreen() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Pulse animation for upload zone when active
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadDocuments(); }, []);

  useEffect(() => {
    if (uploading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [uploading]);

  const loadDocuments = async () => {
    try {
      const { data } = await documentsApi.list();
      setDocuments(data.documents);
    } catch {
      // silent — empty list is fine
    } finally {
      setFetching(false);
    }
  };

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
      setUploading(true);

      const formData = new FormData();
      formData.append('document', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as any);

      await documentsApi.upload(formData);
      await loadDocuments();
    } catch (err: any) {
      Alert.alert(
        'Upload failed',
        err?.response?.data?.error ?? 'Something went wrong. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const statusIcon = (status: Document['status']) => {
    if (status === 'ready') return '✓';
    if (status === 'failed') return '✗';
    return null;
  };

  const statusColor = (status: Document['status']) => {
    if (status === 'ready') return colors.accent.success;
    if (status === 'failed') return colors.accent.danger;
    return colors.text.muted;
  };

  const readyDocs = documents.filter(d => d.status === 'ready');
  const canGenerate = readyDocs.length > 0;

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Upload Documents</Text>
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
                <Text style={styles.dropzoneText}>Processing your document...</Text>
                <Text style={styles.dropzoneHint}>This may take up to 30 seconds</Text>
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

        {/* Documents list */}
        {fetching ? (
          <ActivityIndicator color={colors.accent.primary} style={styles.loader} />
        ) : documents.length > 0 ? (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>Uploaded ({documents.length})</Text>
            {documents.map(doc => (
              <View key={doc._id} style={styles.docCard}>
                <Text style={styles.docEmoji}>📄</Text>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
                  <Text style={styles.docMeta}>
                    {doc.status === 'ready'
                      ? `${doc.wordCount.toLocaleString()} words`
                      : doc.status === 'failed'
                        ? 'Processing failed'
                        : 'Processing...'}
                  </Text>
                </View>
                {doc.status === 'processing' ? (
                  <ActivityIndicator size="small" color={colors.text.muted} />
                ) : (
                  <Text style={[styles.statusBadge, { color: statusColor(doc.status) }]}>
                    {statusIcon(doc.status)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* CTA — Generate Questions */}
        <View style={styles.ctaWrapper}>
          {canGenerate ? (
            <Pressable
              onPress={() => router.push('/(tabs)/sessions')}
              style={({ pressed }) => [styles.btnOuter, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={['#6C63FF', '#A855F7', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btn}
              >
                <Text style={styles.btnText}>Generate Questions →</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={[styles.btnOuter, styles.btnDisabled]}>
              <LinearGradient
                colors={['#1A1E29', '#1A1E29', '#1A1E29']}
                style={styles.btn}
              >
                <Text style={styles.btnTextMuted}>Upload a document to continue</Text>
              </LinearGradient>
            </View>
          )}
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  orb1: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  orb2: {
    position: 'absolute', bottom: 50, left: -100,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },

  scroll:    { flex: 1 },
  container: { paddingHorizontal: screenPadding, paddingTop: 60, paddingBottom: 48 },

  header:   { marginBottom: spacing['2xl'] },
  title:    { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  subtitle: { fontSize: typography.scale.sm, color: colors.text.muted, marginTop: spacing.xs },

  dropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    borderRadius: radius.xl,
    paddingVertical: 48,
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dropzoneActive: { borderColor: colors.accent.primary },
  uploadIcon:     { fontSize: 44, marginBottom: spacing.md },
  dropzoneText:   { fontSize: typography.scale.md, color: colors.text.secondary, fontWeight: typography.weights.medium, marginBottom: spacing.xs, marginTop: spacing.sm },
  dropzoneHint:   { fontSize: typography.scale.sm, color: colors.text.muted },

  loader:    { marginTop: spacing.xl },
  listSection: { marginBottom: spacing['2xl'] },
  listTitle: {
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  docEmoji:    { fontSize: 22, marginRight: spacing.md },
  docInfo:     { flex: 1 },
  docName:     { fontSize: typography.scale.base, color: colors.text.primary, fontWeight: typography.weights.medium },
  docMeta:     { fontSize: typography.scale.xs, color: colors.text.muted, marginTop: 2 },
  statusBadge: { fontSize: 18, fontWeight: typography.weights.bold },

  ctaWrapper:   { marginTop: spacing.md },
  btnOuter:     {},
  btnDisabled:  { opacity: 0.5 },
  btn:          { borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  btnText:      { color: '#fff', fontSize: typography.scale.md, fontWeight: typography.weights.semibold },
  btnTextMuted: { color: colors.text.muted, fontSize: typography.scale.base },
});
