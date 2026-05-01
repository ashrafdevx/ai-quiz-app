import {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { interviewApi, type InterviewEvaluation, extractMessage } from '../services/api';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius, screenPadding } from '../constants/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage =
  | 'setup'       // topic prompt input
  | 'generating'  // AI generating first question
  | 'answering'   // waiting for user answer
  | 'submitting'  // evaluating answer
  | 'reviewed'    // feedback shown
  | 'next_q'      // loading next question
  | 'completed';  // session done

type ChatMsg =
  | { id: string; type: 'question'; text: string; qIndex: number }
  | { id: string; type: 'answer';   text: string; mode: 'text' | 'voice' }
  | { id: string; type: 'feedback'; evaluation: InterviewEvaluation }
  | { id: string; type: 'typing' };

const CATEGORY_COLORS: Record<string, string> = {
  web: '#3B82F6', 'react-native': '#61DAFB', android: '#3DDC84',
  devops: '#F97316', python: '#3776AB', java: '#ED8B00',
  database: '#10B981', 'system-design': '#8B5CF6',
  behavioral: '#EC4899', algorithms: '#6C63FF',
  javascript: '#F7DF1E', typescript: '#3178C6', other: '#94A3B8',
};

function scoreColor(s: number) {
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#F59E0B';
  return '#EF4444';
}

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InterviewScreen() {
  const router = useRouter();

  // Session state
  const [stage,      setStage]      = useState<Stage>('setup');
  const [topic,      setTopic]      = useState('');
  const [sessionId,  setSessionId]  = useState('');
  const [category,   setCategory]   = useState('');
  const [qIndex,     setQIndex]     = useState(0);
  const [messages,   setMessages]   = useState<ChatMsg[]>([]);
  const [summary,    setSummary]    = useState<{ avgScore: number; questionCount: number; answeredCount: number } | null>(null);

  // Input state
  const [draft,       setDraft]       = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recElapsed,  setRecElapsed]  = useState(0);
  const [expandedFb,  setExpandedFb]  = useState<Record<string, boolean>>({});

  // Refs
  const scrollRef   = useRef<ScrollView>(null);
  const recordRef   = useRef<Audio.Recording | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseLoop   = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Cleanup
  useEffect(() => () => {
    clearInterval(timerRef.current!);
    recordRef.current?.stopAndUnloadAsync().catch(() => {});
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const pushMsg = useCallback((msg: ChatMsg) =>
    setMessages(prev => [...prev.filter(m => m.type !== 'typing'), msg]), []);

  const showTyping = useCallback(() =>
    setMessages(prev => [...prev.filter(m => m.type !== 'typing'), { id: 'typing', type: 'typing' }]), []);

  // ── Start session ──────────────────────────────────────────────────────────

  async function startSession() {
    if (!topic.trim()) return;
    setStage('generating');
    showTyping();
    try {
      const { data } = await interviewApi.start(topic.trim());
      setSessionId(data.sessionId);
      setCategory(data.category);
      setQIndex(0);
      pushMsg({ id: `q-0`, type: 'question', text: data.question, qIndex: 0 });
      setStage('answering');
    } catch (err: any) {
      setMessages([]);
      setStage('setup');
      Alert.alert('Could not start', extractMessage(err));
    }
  }

  // ── Submit text answer ─────────────────────────────────────────────────────

  async function submitAnswer() {
    const answer = draft.trim();
    if (!answer || stage !== 'answering') return;
    setDraft('');
    setStage('submitting');

    pushMsg({ id: `u-${qIndex}`, type: 'answer', text: answer, mode: 'text' });
    showTyping();

    try {
      const { data } = await interviewApi.answer(sessionId, answer, qIndex);
      pushMsg({ id: `fb-${qIndex}`, type: 'feedback', evaluation: data.evaluation });
      setStage('reviewed');
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.type !== 'typing'));
      setStage('answering');
      Alert.alert('Evaluation failed', extractMessage(err));
    }
  }

  // ── Voice recording ────────────────────────────────────────────────────────

  async function startRecording() {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Microphone needed', 'Allow microphone access to answer by voice.');
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordRef.current = recording;
    setRecElapsed(0);
    setIsRecording(true);
    timerRef.current = setInterval(() => setRecElapsed(e => e + 1), 1000);
  }

  async function stopRecording() {
    clearInterval(timerRef.current!);
    setIsRecording(false);
    setStage('submitting');

    try {
      await recordRef.current?.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordRef.current?.getURI();
      recordRef.current = null;
      if (!uri) throw new Error('No audio recorded.');

      showTyping();
      const result = await interviewApi.voice(sessionId, uri, qIndex);
      pushMsg({ id: `u-${qIndex}`, type: 'answer', text: result.transcript, mode: 'voice' });
      pushMsg({ id: `fb-${qIndex}`, type: 'feedback', evaluation: result.evaluation });
      setStage('reviewed');
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.type !== 'typing'));
      setStage('answering');
      Alert.alert('Voice failed', extractMessage(err));
    }
  }

  // ── Next question ──────────────────────────────────────────────────────────

  async function nextQuestion() {
    setStage('next_q');
    showTyping();
    try {
      const { data } = await interviewApi.next(sessionId);
      setQIndex(data.questionIndex);
      pushMsg({ id: `q-${data.questionIndex}`, type: 'question', text: data.question, qIndex: data.questionIndex });
      setStage('answering');
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.type !== 'typing'));
      setStage('reviewed');
      Alert.alert('Could not load next question', extractMessage(err));
    }
  }

  // ── End session ────────────────────────────────────────────────────────────

  async function endSession() {
    try {
      const { data } = await interviewApi.complete(sessionId);
      setSummary({ avgScore: data.avgScore, questionCount: data.questionCount, answeredCount: data.answeredCount });
      setStage('completed');
    } catch {
      setSummary(null);
      setStage('completed');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const catColor = CATEGORY_COLORS[category] ?? '#94A3B8';
  const isLoading = stage === 'generating' || stage === 'submitting' || stage === 'next_q';
  const inputDisabled = stage !== 'answering' || isRecording;

  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>AI Interview</Text>
            {category ? (
              <View style={[styles.catBadge, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }]}>
                <Text style={[styles.catText, { color: catColor }]}>{category}</Text>
              </View>
            ) : null}
          </View>
          {stage !== 'setup' && stage !== 'completed' && (
            <Pressable onPress={endSession} style={styles.endBtn}>
              <Text style={styles.endBtnText}>End</Text>
            </Pressable>
          )}
          {(stage === 'setup' || stage === 'completed') && <View style={{ width: 48 }} />}
        </View>

        {/* ── SETUP SCREEN ── */}
        {stage === 'setup' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.setupOuter}
          >
            <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled">
              <View style={styles.setupHero}>
                <LinearGradient colors={['#6C63FF', '#A855F7', '#EC4899']} style={styles.setupIcon}>
                  <Ionicons name="chatbubbles" size={36} color="#fff" />
                </LinearGradient>
                <Text style={styles.setupTitle}>AI Interview Practice</Text>
                <Text style={styles.setupSub}>
                  Describe what you want to practice and the AI will interview you — question by question, with instant feedback.
                </Text>
              </View>

              <View style={styles.setupCard}>
                <Text style={styles.setupLabel}>What do you want to practice?</Text>
                <TextInput
                  style={styles.setupInput}
                  value={topic}
                  onChangeText={setTopic}
                  placeholder='e.g. "React Native interview questions"'
                  placeholderTextColor={colors.text.muted}
                  multiline
                  returnKeyType="done"
                  onSubmitEditing={startSession}
                />

                <View style={styles.exampleRow}>
                  {['Web development', 'System design', 'Behavioral HR'].map(ex => (
                    <Pressable key={ex} style={styles.exampleChip} onPress={() => setTopic(ex)}>
                      <Text style={styles.exampleText}>{ex}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={startSession}
                disabled={!topic.trim()}
                style={({ pressed }) => [pressed && topic.trim() && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={topic.trim() ? ['#6C63FF', '#A855F7', '#EC4899'] : ['#1A1E29', '#1A1E29', '#1A1E29']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.startBtn}
                >
                  <Ionicons name="flash" size={18} color={topic.trim() ? '#fff' : colors.text.muted} />
                  <Text style={[styles.startBtnText, !topic.trim() && { color: colors.text.muted }]}>
                    Start Interview
                  </Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── CHAT + INPUT ── */}
        {stage !== 'setup' && stage !== 'completed' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            {/* Chat area */}
            <ScrollView
              ref={scrollRef}
              style={styles.chat}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Topic pill */}
              <View style={styles.topicPill}>
                <Text style={styles.topicPillText}>Topic: {topic}</Text>
              </View>

              {messages.map(msg => {
                if (msg.type === 'typing') return <TypingIndicator key="typing" />;

                if (msg.type === 'question') return (
                  <View key={msg.id} style={styles.aiBubbleWrap}>
                    <View style={styles.aiAvatar}>
                      <Ionicons name="chatbubble-ellipses" size={14} color="#A855F7" />
                    </View>
                    <View style={styles.aiBubble}>
                      <Text style={styles.aiBubbleLabel}>Q{msg.qIndex + 1}</Text>
                      <Text style={styles.aiBubbleText}>{msg.text}</Text>
                    </View>
                  </View>
                );

                if (msg.type === 'answer') return (
                  <View key={msg.id} style={styles.userBubbleWrap}>
                    <View style={styles.userBubble}>
                      {msg.mode === 'voice' && (
                        <View style={styles.voiceTag}>
                          <Ionicons name="mic" size={11} color="#A855F7" />
                          <Text style={styles.voiceTagText}>Voice</Text>
                        </View>
                      )}
                      <Text style={styles.userBubbleText}>{msg.text}</Text>
                    </View>
                  </View>
                );

                if (msg.type === 'feedback') {
                  const ev = msg.evaluation;
                  const isOpen = expandedFb[msg.id] ?? false;
                  return (
                    <View key={msg.id} style={styles.feedbackCard}>
                      {/* Score row */}
                      <View style={styles.feedbackScoreRow}>
                        <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor(ev.score)}22` }]}>
                          <Text style={[styles.scoreValue, { color: scoreColor(ev.score) }]}>{ev.score}</Text>
                          <Text style={[styles.scoreMax, { color: scoreColor(ev.score) }]}>/100</Text>
                        </View>
                        <Text style={styles.feedbackVerdict} numberOfLines={isOpen ? 0 : 2}>{ev.feedback}</Text>
                      </View>

                      {isOpen && (
                        <>
                          {ev.mistakes.length > 0 && (
                            <View style={styles.fbSection}>
                              <Text style={styles.fbSectionTitle}>❌ Gaps / Mistakes</Text>
                              {ev.mistakes.map((m, i) => (
                                <Text key={i} style={styles.fbItem}>• {m}</Text>
                              ))}
                            </View>
                          )}
                          {ev.improvements.length > 0 && (
                            <View style={styles.fbSection}>
                              <Text style={styles.fbSectionTitle}>💡 Improvements</Text>
                              {ev.improvements.map((imp, i) => (
                                <Text key={i} style={styles.fbItem}>• {imp}</Text>
                              ))}
                            </View>
                          )}
                          {ev.improvedAnswer ? (
                            <View style={[styles.fbSection, styles.improvedBox]}>
                              <Text style={styles.fbSectionTitle}>✨ Model Answer</Text>
                              <Text style={styles.improvedText}>{ev.improvedAnswer}</Text>
                            </View>
                          ) : null}
                        </>
                      )}

                      <Pressable
                        onPress={() => setExpandedFb(prev => ({ ...prev, [msg.id]: !isOpen }))}
                        style={styles.fbToggle}
                      >
                        <Text style={styles.fbToggleText}>{isOpen ? 'Show less ▲' : 'Show details ▼'}</Text>
                      </Pressable>
                    </View>
                  );
                }

                return null;
              })}

              {/* Action buttons after feedback */}
              {stage === 'reviewed' && (
                <View style={styles.actionBtns}>
                  <Pressable style={styles.nextBtn} onPress={nextQuestion}>
                    <LinearGradient
                      colors={['#6C63FF', '#A855F7']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.nextBtnInner}
                    >
                      <Text style={styles.nextBtnText}>Next Question</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                  <Pressable style={styles.endSessionBtn} onPress={endSession}>
                    <Text style={styles.endSessionText}>End Session</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* ── Input bar ── */}
            <View style={styles.inputBar}>
              {isRecording ? (
                /* Recording overlay */
                <View style={styles.recordingBar}>
                  <View style={styles.recDot} />
                  <Text style={styles.recTimer}>{formatTime(recElapsed)}</Text>
                  <Text style={styles.recLabel}>Recording…</Text>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Pressable onPress={stopRecording} style={styles.stopRecBtn}>
                      <Ionicons name="stop-circle" size={28} color="#EF4444" />
                    </Pressable>
                  </Animated.View>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.textInput}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={inputDisabled ? 'Waiting…' : 'Type your answer…'}
                    placeholderTextColor={colors.text.muted}
                    multiline
                    editable={!inputDisabled}
                    onSubmitEditing={submitAnswer}
                  />
                  <Pressable
                    onPress={stage === 'answering' ? startRecording : undefined}
                    style={[styles.micBtn, stage !== 'answering' && styles.btnDisabled]}
                    disabled={stage !== 'answering'}
                  >
                    <Ionicons name="mic" size={20} color={stage === 'answering' ? '#A855F7' : colors.text.muted} />
                  </Pressable>
                  <Pressable
                    onPress={submitAnswer}
                    disabled={!draft.trim() || stage !== 'answering'}
                    style={[styles.sendBtn, (!draft.trim() || stage !== 'answering') && styles.btnDisabled]}
                  >
                    {isLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={18} color="#fff" />
                    }
                  </Pressable>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ── COMPLETED SCREEN ── */}
        {stage === 'completed' && (
          <ScrollView contentContainerStyle={styles.completedContent}>
            <View style={styles.completedHero}>
              <Text style={styles.completedEmoji}>🎉</Text>
              <Text style={styles.completedTitle}>Session Complete!</Text>
              <Text style={styles.completedSub}>Topic: {topic}</Text>
            </View>

            {summary && (
              <View style={styles.summaryCard}>
                <SummaryRow label="Questions answered" value={`${summary.answeredCount} / ${summary.questionCount}`} />
                <SummaryRow
                  label="Average score"
                  value={`${summary.avgScore}/100`}
                  valueColor={scoreColor(summary.avgScore)}
                />
              </View>
            )}

            <Pressable style={styles.doneBtn} onPress={() => router.back()}>
              <LinearGradient
                colors={['#6C63FF', '#A855F7', '#EC4899']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.doneBtnInner}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1,   duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]));
    const a = Animated.parallel([anim(dot1, 0), anim(dot2, 150), anim(dot3, 300)]);
    a.start();
    return () => a.stop();
  }, []);

  return (
    <View style={styles.aiBubbleWrap}>
      <View style={styles.aiAvatar}>
        <Ionicons name="chatbubble-ellipses" size={14} color="#A855F7" />
      </View>
      <View style={[styles.aiBubble, styles.typingBubble]}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[styles.typingDot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg:      { flex: 1 },
  safeArea:{ flex: 1 },
  orb1:    { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108,99,255,0.10)' },
  orb2:    { position: 'absolute', bottom: 50, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(168,85,247,0.07)' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: screenPadding, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg.surface, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle:  { fontSize: typography.scale.base, fontWeight: typography.weights.semibold, color: colors.text.primary },
  catBadge:     { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1 },
  catText:      { fontSize: typography.scale.xs, fontWeight: typography.weights.semibold, textTransform: 'capitalize' },
  endBtn:       { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default },
  endBtnText:   { fontSize: typography.scale.xs, color: colors.text.muted },

  // Setup screen
  setupOuter:   { flex: 1 },
  setupContent: { paddingHorizontal: screenPadding, paddingTop: spacing['2xl'], paddingBottom: spacing['3xl'] },
  setupHero:    { alignItems: 'center', marginBottom: spacing['3xl'], gap: spacing.lg },
  setupIcon:    { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  setupTitle:   { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  setupSub:     { fontSize: typography.scale.sm, color: colors.text.muted, textAlign: 'center', lineHeight: 20 },
  setupCard:    { backgroundColor: colors.bg.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.default, padding: spacing.xl, marginBottom: spacing['2xl'] },
  setupLabel:   { fontSize: typography.scale.sm, color: colors.text.secondary, fontWeight: typography.weights.medium, marginBottom: spacing.md },
  setupInput:   { fontSize: typography.scale.base, color: colors.text.primary, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  exampleRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  exampleChip:  { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: 'rgba(108,99,255,0.12)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)' },
  exampleText:  { fontSize: typography.scale.xs, color: '#6C63FF' },
  startBtn:     { borderRadius: radius.lg, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  startBtnText: { color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },

  // Chat
  chat:        { flex: 1 },
  chatContent: { paddingHorizontal: screenPadding, paddingVertical: spacing.xl, gap: spacing.lg },
  topicPill:   { alignSelf: 'center', backgroundColor: 'rgba(108,99,255,0.10)', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(108,99,255,0.20)', marginBottom: spacing.sm },
  topicPillText:{ fontSize: typography.scale.xs, color: colors.text.muted },

  // AI bubble
  aiBubbleWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  aiAvatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  aiBubble:     { flex: 1, backgroundColor: colors.bg.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default, padding: spacing.lg },
  aiBubbleLabel:{ fontSize: typography.scale.xs, color: '#A855F7', fontWeight: typography.weights.semibold, marginBottom: spacing.xs },
  aiBubbleText: { fontSize: typography.scale.base, color: colors.text.primary, lineHeight: 22 },

  // Typing bubble
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.md },
  typingDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A855F7' },

  // User bubble
  userBubbleWrap: { alignItems: 'flex-end' },
  userBubble:     { maxWidth: '82%', backgroundColor: 'rgba(108,99,255,0.15)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)', padding: spacing.lg },
  voiceTag:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  voiceTagText:   { fontSize: typography.scale.xs, color: '#A855F7' },
  userBubbleText: { fontSize: typography.scale.base, color: colors.text.primary, lineHeight: 22 },

  // Feedback card
  feedbackCard:     { backgroundColor: colors.bg.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.default, padding: spacing.xl, gap: spacing.lg },
  feedbackScoreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  scoreBadge:       { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', minWidth: 64 },
  scoreValue:       { fontSize: typography.scale.xl, fontWeight: typography.weights.bold },
  scoreMax:         { fontSize: typography.scale.xs, fontWeight: typography.weights.medium },
  feedbackVerdict:  { flex: 1, fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },
  fbSection:        { gap: spacing.sm },
  fbSectionTitle:   { fontSize: typography.scale.sm, fontWeight: typography.weights.semibold, color: colors.text.primary },
  fbItem:           { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },
  improvedBox:      { backgroundColor: 'rgba(108,99,255,0.08)', borderRadius: radius.md, padding: spacing.lg },
  improvedText:     { fontSize: typography.scale.sm, color: colors.text.secondary, lineHeight: 20 },
  fbToggle:         { alignSelf: 'center' },
  fbToggleText:     { fontSize: typography.scale.xs, color: '#6C63FF' },

  // Action buttons (next / end session)
  actionBtns:     { gap: spacing.md, marginTop: spacing.sm },
  nextBtn:        { borderRadius: radius.lg, overflow: 'hidden' },
  nextBtnInner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  nextBtnText:    { color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },
  endSessionBtn:  { alignItems: 'center', paddingVertical: spacing.md },
  endSessionText: { color: colors.text.muted, fontSize: typography.scale.sm },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: screenPadding, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: colors.bg.base,
  },
  textInput: {
    flex: 1, backgroundColor: colors.bg.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    fontSize: typography.scale.base, color: colors.text.primary,
    maxHeight: 120, lineHeight: 20,
  },
  micBtn:  { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(168,85,247,0.12)', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.4 },

  // Recording bar
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.md },
  recDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recTimer:     { fontSize: typography.scale.base, color: colors.text.primary, fontFamily: 'monospace', fontWeight: typography.weights.semibold },
  recLabel:     { flex: 1, fontSize: typography.scale.sm, color: colors.text.muted },
  stopRecBtn:   { padding: 2 },

  // Completed screen
  completedContent: { paddingHorizontal: screenPadding, paddingTop: spacing['3xl'], paddingBottom: spacing['3xl'], gap: spacing['2xl'] },
  completedHero:    { alignItems: 'center', gap: spacing.md },
  completedEmoji:   { fontSize: 56 },
  completedTitle:   { fontSize: typography.scale['2xl'], fontWeight: typography.weights.bold, color: colors.text.primary },
  completedSub:     { fontSize: typography.scale.sm, color: colors.text.muted },
  summaryCard:      { backgroundColor: colors.bg.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.default, padding: spacing.xl, gap: spacing.lg },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:     { fontSize: typography.scale.base, color: colors.text.secondary },
  summaryValue:     { fontSize: typography.scale.base, fontWeight: typography.weights.bold, color: colors.text.primary },
  doneBtn:          { borderRadius: radius.lg, overflow: 'hidden' },
  doneBtnInner:     { paddingVertical: spacing.lg, alignItems: 'center' },
  doneBtnText:      { color: '#fff', fontSize: typography.scale.base, fontWeight: typography.weights.semibold },
});
