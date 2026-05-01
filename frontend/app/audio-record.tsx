import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { documentsApi, extractMessage } from '../services/api';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, screenPadding } from '../constants/spacing';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat,
  withSequence, withTiming, cancelAnimation,
} from 'react-native-reanimated';

type Stage = 'idle' | 'recording' | 'processing' | 'done';

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function AudioRecordScreen() {
  const router = useRouter();

  const [stage,      setStage]      = useState<Stage>('idle');
  const [transcript, setTranscript] = useState('');
  const [elapsed,    setElapsed]    = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [isPlaying,  setIsPlaying]  = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef     = useRef<Audio.Sound | null>(null);
  const audioUriRef  = useRef<string | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for recording state
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    if (stage === 'recording') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 600 }),
          withTiming(1.0,  { duration: 600 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [stage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current!);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Permissions ───────────────────────────────────────────────────────────

  async function requestPermission(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone access needed',
        'Please allow microphone access in your device settings to record audio.',
      );
      return false;
    }
    return true;
  }

  // ── Record ────────────────────────────────────────────────────────────────

  async function startRecording() {
    const ok = await requestPermission();
    if (!ok) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setElapsed(0);
      setStage('recording');

      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err: any) {
      Alert.alert('Could not start recording', err.message ?? 'Unknown error');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current!);
    setStage('processing');

    try {
      await recordingRef.current?.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current?.getURI() ?? null;
      recordingRef.current = null;
      audioUriRef.current = uri;

      if (!uri) throw new Error('No audio file produced.');

      await transcribeRecording(uri);
    } catch (err: any) {
      Alert.alert('Processing failed', extractMessage(err, 'Could not transcribe audio. Please try again.'));
      setStage('idle');
    }
  }

  async function transcribeRecording(uri: string) {
    const formData = new FormData();
    formData.append('audio', {
      uri,
      name: 'recording.m4a',
      type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mpeg',
    } as any);

    const { transcript: text } = await documentsApi.transcribe(formData);
    setTranscript(text);
    setStage('done');
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  async function togglePlayback() {
    const uri = audioUriRef.current;
    if (!uri) return;

    if (isPlaying) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
      return;
    }

    const { sound } = await Audio.Sound.createAsync({ uri });
    soundRef.current = sound;
    setIsPlaying(true);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        soundRef.current = null;
        setIsPlaying(false);
      }
    });

    await sound.playAsync();
  }

  // ── Re-record ─────────────────────────────────────────────────────────────

  async function reRecord() {
    await soundRef.current?.unloadAsync();
    soundRef.current = null;
    setIsPlaying(false);
    audioUriRef.current = null;
    setTranscript('');
    setElapsed(0);
    setStage('idle');
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!transcript.trim()) {
      Alert.alert('Empty transcript', 'Please record audio or type some text before saving.');
      return;
    }
    try {
      setSaving(true);
      const name = `Voice note ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const { data } = await documentsApi.fromText(transcript.trim(), name);
      router.replace({ pathname: '/session/new', params: { docId: data.documentId } });
    } catch (err: any) {
      Alert.alert('Save failed', extractMessage(err, 'Could not save transcript. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Record Audio</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── IDLE ── */}
          {stage === 'idle' && (
            <View style={styles.centeredSection}>
              <Pressable onPress={startRecording}>
                <LinearGradient
                  colors={['#6C63FF', '#A855F7', '#EC4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.micCircle}
                >
                  <Ionicons name="mic" size={48} color="#fff" />
                </LinearGradient>
              </Pressable>
              <Text style={styles.stageTitle}>Tap to start recording</Text>
              <Text style={styles.stageHint}>Speak clearly — we'll transcribe your words into text</Text>
            </View>
          )}

          {/* ── RECORDING ── */}
          {stage === 'recording' && (
            <View style={styles.centeredSection}>
              <Animated.View style={pulseStyle}>
                <Pressable onPress={stopRecording}>
                  <View style={styles.micCircleRecording}>
                    <View style={styles.stopSquare} />
                  </View>
                </Pressable>
              </Animated.View>

              <View style={styles.recordingMeta}>
                <View style={styles.redDot} />
                <Text style={styles.recordingLabel}>Recording</Text>
                <Text style={styles.timer}>{formatTime(elapsed)}</Text>
              </View>

              <Text style={styles.stageHint}>Tap the button to stop</Text>

              <Pressable onPress={stopRecording} style={styles.stopBtn}>
                <Text style={styles.stopBtnText}>Stop Recording</Text>
              </Pressable>
            </View>
          )}

          {/* ── PROCESSING ── */}
          {stage === 'processing' && (
            <View style={styles.centeredSection}>
              <View style={styles.processingCircle}>
                <ActivityIndicator size="large" color="#A855F7" />
              </View>
              <Text style={styles.stageTitle}>Transcribing audio…</Text>
              <Text style={styles.stageHint}>This usually takes a few seconds</Text>
            </View>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && (
            <View style={styles.doneSection}>

              {/* Playback + re-record row */}
              <View style={styles.actionsRow}>
                <Pressable style={styles.playBtn} onPress={togglePlayback}>
                  <Ionicons
                    name={isPlaying ? 'stop-circle' : 'play-circle'}
                    size={20}
                    color="#A855F7"
                  />
                  <Text style={styles.playBtnText}>{isPlaying ? 'Stop' : 'Play back'}</Text>
                </Pressable>

                <Pressable style={styles.reRecordBtn} onPress={reRecord}>
                  <Ionicons name="refresh" size={16} color={colors.text.secondary} />
                  <Text style={styles.reRecordText}>Re-record</Text>
                </Pressable>
              </View>

              {/* Transcript editor */}
              <View style={styles.transcriptCard}>
                <View style={styles.transcriptHeader}>
                  <Ionicons name="document-text-outline" size={16} color="#A855F7" />
                  <Text style={styles.transcriptLabel}>Transcript</Text>
                  <Text style={styles.editHint}>Tap to edit</Text>
                </View>
                <TextInput
                  style={styles.transcriptInput}
                  value={transcript}
                  onChangeText={setTranscript}
                  multiline
                  placeholder="Your transcript will appear here…"
                  placeholderTextColor={colors.text.muted}
                  textAlignVertical="top"
                />
              </View>

              {/* Save CTA */}
              <Pressable
                onPress={save}
                disabled={saving || !transcript.trim()}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={transcript.trim() ? ['#6C63FF', '#A855F7', '#EC4899'] : ['#1A1E29', '#1A1E29', '#1A1E29']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="flash" size={18} color={transcript.trim() ? '#fff' : colors.text.muted} />
                        <Text style={[styles.saveBtnText, !transcript.trim() && { color: colors.text.muted }]}>
                          Generate Quiz from Transcript
                        </Text>
                      </>
                  }
                </LinearGradient>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:      { flex: 1 },
  safeArea:{ flex: 1 },
  orb1:    { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108,99,255,0.12)' },
  orb2:    { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168,85,247,0.08)' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: screenPadding, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.scale.md, fontWeight: typography.weights.semibold, color: colors.text.primary },

  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: screenPadding, paddingTop: spacing['3xl'], paddingBottom: spacing['3xl'] },

  // Centered layout (idle / recording / processing)
  centeredSection: { alignItems: 'center', gap: spacing.xl },

  // Mic button — idle
  micCircle: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
  },

  // Mic button — recording (red)
  micCircleRecording: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 10,
  },
  stopSquare: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#fff' },

  recordingMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  redDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recordingLabel:{ fontSize: typography.scale.base, color: colors.text.primary, fontWeight: typography.weights.medium },
  timer:         { fontSize: typography.scale.base, color: colors.text.secondary, fontFamily: 'monospace' },

  stopBtn:     { borderWidth: 1, borderColor: colors.border.strong, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'] },
  stopBtnText: { color: colors.text.secondary, fontSize: typography.scale.sm, fontWeight: typography.weights.medium },

  // Processing
  processingCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(168,85,247,0.30)',
  },

  stageTitle: { fontSize: typography.scale.lg, fontWeight: typography.weights.bold, color: colors.text.primary, textAlign: 'center' },
  stageHint:  { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', maxWidth: 280 },

  // Done state
  doneSection: { gap: spacing.xl },
  actionsRow:  { flexDirection: 'row', gap: spacing.md },

  playBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(168,85,247,0.30)',
    paddingVertical: spacing.md,
  },
  playBtnText: { fontSize: typography.scale.sm, color: '#A855F7', fontWeight: typography.weights.medium },

  reRecordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  reRecordText: { fontSize: typography.scale.sm, color: colors.text.secondary },

  transcriptCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing.lg,
  },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  transcriptLabel:  { flex: 1, fontSize: typography.scale.sm, fontWeight: typography.weights.semibold, color: colors.text.secondary },
  editHint:         { fontSize: typography.scale.xs, color: colors.text.muted },
  transcriptInput:  {
    fontSize: typography.scale.base, color: colors.text.primary,
    lineHeight: 22, minHeight: 160,
  },

  saveBtn:     { borderRadius: radius.lg, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  saveBtnText: { color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },
});
