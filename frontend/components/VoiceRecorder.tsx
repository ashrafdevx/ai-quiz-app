import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { voiceAnswerApi, VoiceAnswerResult, extractMessage } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type RecorderState = 'idle' | 'recording' | 'recorded' | 'submitting' | 'done';

interface Props {
  sessionId: string;
  questionId: number;
  onResult: (result: VoiceAnswerResult) => void;
  disabled?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VoiceRecorder({ sessionId, questionId, onResult, disabled }: Props) {
  const [state, setState]             = useState<RecorderState>('idle');
  const [elapsed, setElapsed]         = useState(0);
  const [audioUri, setAudioUri]       = useState<string | null>(null);
  const [duration, setDuration]       = useState<number>(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const recordingRef  = useRef<Audio.Recording | null>(null);
  const soundRef      = useRef<Audio.Sound | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const pulseLoop     = useRef<Animated.CompositeAnimation | null>(null);

  // Pulse animation while recording
  useEffect(() => {
    if (state === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Recording controls ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Access Needed',
          'Please allow microphone access in Settings to record your answers.',
          [{ text: 'OK' }]
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;

      setElapsed(0);
      setState('recording');
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } catch (err: any) {
      setError('Could not start recording. Please try again.');
      console.error('[VoiceRecorder] start error:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    timerRef.current && clearInterval(timerRef.current);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) throw new Error('No audio captured.');
      setAudioUri(uri);
      setDuration(elapsed);
      setState('recorded');
    } catch (err: any) {
      setError('Recording failed. Please try again.');
      setState('idle');
    }
  }, [elapsed]);

  // ── Playback ─────────────────────────────────────────────────────────────────

  const togglePlayback = useCallback(async () => {
    if (!audioUri) return;

    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      return;
    }

    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      } else {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) setIsPlaying(false);
          }
        );
        soundRef.current = sound;
      }
      setIsPlaying(true);
    } catch (err) {
      console.error('[VoiceRecorder] playback error:', err);
    }
  }, [audioUri, isPlaying]);

  const reRecord = useCallback(async () => {
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    setAudioUri(null);
    setElapsed(0);
    setIsPlaying(false);
    setError(null);
    setState('idle');
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────────

  const submitAnswer = useCallback(async () => {
    if (!audioUri) return;
    setState('submitting');
    setError(null);

    try {
      const result = await voiceAnswerApi.submit(sessionId, audioUri, questionId, duration);
      setState('done');
      onResult(result);
    } catch (err: any) {
      setError(extractMessage(err, 'Submission failed. Please try again.'));
      setState('recorded');
    }
  }, [audioUri, sessionId, questionId, duration, onResult]);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (state === 'done') return null; // parent renders result card

  const isRecording  = state === 'recording';
  const isRecorded   = state === 'recorded';
  const isSubmitting = state === 'submitting';

  return (
    <View style={styles.wrapper}>
      {/* Mic button */}
      <View style={styles.micRow}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            style={[
              styles.micBtn,
              isRecording  && styles.micBtnActive,
              isRecorded   && styles.micBtnRecorded,
              (isSubmitting || disabled) && styles.micBtnDisabled,
            ]}
            onPress={isRecording ? stopRecording : isRecorded ? undefined : startRecording}
            disabled={isSubmitting || disabled || isRecorded}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.statusCol}>
          {isRecording && (
            <>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>REC</Text>
              </View>
              <Text style={styles.timer}>{formatTime(elapsed)}</Text>
            </>
          )}
          {!isRecording && state === 'idle' && (
            <Text style={styles.idleLabel}>Tap to record your answer</Text>
          )}
          {isRecorded && (
            <Text style={styles.recordedLabel}>
              Recording ready ({formatTime(duration)})
            </Text>
          )}
        </View>
      </View>

      {/* Recorded controls */}
      {isRecorded && (
        <View style={styles.controls}>
          <Pressable onPress={togglePlayback} style={styles.playBtn}>
            <Text style={styles.playBtnText}>{isPlaying ? '⏸ Pause' : '▶ Play back'}</Text>
          </Pressable>

          <Pressable onPress={submitAnswer} style={styles.submitBtn}>
            <Text style={styles.submitBtnText}>Submit Answer →</Text>
          </Pressable>

          <Pressable onPress={reRecord} style={styles.reRecordBtn}>
            <Text style={styles.reRecordText}>↺ Re-record</Text>
          </Pressable>
        </View>
      )}

      {isSubmitting && (
        <Text style={styles.submittingLabel}>Transcribing and evaluating…</Text>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing['2xl'],
    gap: spacing.lg,
  },

  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },

  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderWidth: 2,
    borderColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderColor: colors.accent.danger,
  },
  micBtnRecorded: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: colors.accent.success,
    opacity: 0.6,
  },
  micBtnDisabled: {
    opacity: 0.4,
  },
  micIcon: {
    fontSize: 28,
  },

  statusCol: {
    flex: 1,
    gap: spacing.xs,
  },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.danger,
  },
  liveText: {
    fontSize: typography.scale.xs,
    color: colors.accent.danger,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  timer: {
    fontSize: typography.scale['2xl'],
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },

  idleLabel: {
    fontSize: typography.scale.sm,
    color: colors.text.muted,
  },
  recordedLabel: {
    fontSize: typography.scale.sm,
    color: colors.accent.success,
    fontWeight: typography.weights.medium,
  },

  controls: {
    gap: spacing.md,
  },

  playBtn: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  playBtnText: {
    fontSize: typography.scale.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },

  submitBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: typography.scale.sm,
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },

  reRecordBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  reRecordText: {
    fontSize: typography.scale.sm,
    color: colors.text.muted,
  },

  submittingLabel: {
    fontSize: typography.scale.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },

  errorText: {
    fontSize: typography.scale.sm,
    color: colors.accent.danger,
    textAlign: 'center',
  },
});
