# 🎨 UI/UX Design System — AI Document Quiz App

> **Purpose:** Visual reference for React Native screens, components, color system, and interaction patterns.  
> Inspired by: Linear, Raycast, Duolingo, Perplexity, and Apple's Liquid Glass language.  
> **Theme:** Dark-first, glass-morphic, voice-centric with micro-animations.

---

## Design Philosophy

| Principle | Application |
|---|---|
| **Voice-first** | Every screen anticipates voice input; mic is always accessible |
| **Dark + Glass** | Rich deep backgrounds + frosted glass cards — never flat white |
| **Alive** | Every state transition animates; nothing pops in or jumps |
| **Scored, not judged** | Feedback feels like a coach, not a red pen |
| **Breathable** | Generous spacing, never cluttered — one focal point per screen |

---

## Color Palette

### Core Colors

```javascript
// colors.ts — import everywhere
export const colors = {
  // Backgrounds (dark-first)
  bg: {
    base:    '#0A0B0F',   // deep navy-black — main background
    surface: '#12151C',   // cards, panels
    raised:  '#1A1E29',   // elevated elements
    overlay: 'rgba(18, 21, 28, 0.85)', // glass backgrounds
  },

  // Brand gradient (voice/AI energy)
  brand: {
    from:  '#6C63FF',   // electric violet
    via:   '#A855F7',   // purple
    to:    '#EC4899',   // pink
  },

  // Accent colors
  accent: {
    primary:  '#6C63FF',  // actions, buttons, highlights
    success:  '#10B981',  // correct answers, scores 80+
    warning:  '#F59E0B',  // partial answers, 50–79
    danger:   '#EF4444',  // wrong, 0–49
    info:     '#38BDF8',  // info, neutral feedback
  },

  // Text
  text: {
    primary:   '#F8FAFC',  // headings, main content
    secondary: '#94A3B8',  // supporting text
    muted:     '#475569',  // hints, placeholders
  },

  // Borders (glass effect)
  border: {
    subtle:   'rgba(255, 255, 255, 0.06)',
    default:  'rgba(255, 255, 255, 0.10)',
    strong:   'rgba(255, 255, 255, 0.18)',
  },
}
```

### Score Color Logic

```javascript
export const getScoreColor = (score: number) => {
  if (score >= 80) return colors.accent.success   // #10B981 green
  if (score >= 50) return colors.accent.warning   // #F59E0B amber  
  return colors.accent.danger                      // #EF4444 red
}
```

---

## Typography

```javascript
// typography.ts
export const typography = {
  // Font families
  fonts: {
    heading: 'Syne',         // install: expo-google-fonts/syne
    body:    'Inter',         // install: expo-google-fonts/inter
    mono:    'JetBrains Mono' // for scores, code, numbers
  },

  // Scale
  scale: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    '2xl': 30,
    '3xl': 38,
  },

  // Weights
  weights: {
    regular: '400',
    medium:  '500',
    semibold:'600',
    bold:    '700',
    black:   '900',
  }
}
```

### Font Install Command

```bash
npx expo install @expo-google-fonts/syne @expo-google-fonts/inter
npx expo install expo-font
```

---

## Spacing & Layout

```javascript
// spacing.ts
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  '2xl': 32,
  '3xl': 48,
}

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
}

// Screen horizontal padding
export const screenPadding = 20
```

---

## Glass Card Component

The signature component. Used for document cards, question cards, feedback panels.

```tsx
// components/GlassCard.tsx
import { BlurView } from 'expo-blur'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { colors, radius } from '@/constants'

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  intensity?: number   // blur intensity 1–100
  tint?: 'dark' | 'light'
}

export const GlassCard = ({
  children,
  style,
  intensity = 20,
  tint = 'dark'
}: GlassCardProps) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.card, style]}>
    <View style={styles.inner}>{children}</View>
  </BlurView>
)

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  inner: {
    padding: 20,
  }
})
```

---

## Gradient Background (App Base)

```tsx
// components/ScreenBackground.tsx
import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'

export const ScreenBackground = ({ children }: { children: React.ReactNode }) => (
  <LinearGradient
    colors={['#0A0B0F', '#0D1018', '#0A0B0F']}
    style={styles.bg}
  >
    {/* Ambient glow orb — top right */}
    <View style={styles.orb1} />
    {/* Ambient glow orb — bottom left */}
    <View style={styles.orb2} />
    {children}
  </LinearGradient>
)

const styles = StyleSheet.create({
  bg:   { flex: 1 },
  orb1: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',  // violet glow
  },
  orb2: {
    position: 'absolute', bottom: 50, left: -100,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',  // purple glow
  }
})
```

---

## Screen Designs

### Screen 1 — Home / Dashboard

```
┌─────────────────────────────┐
│  Good morning, Ashraf  🌙   │  ← greeting, name from auth
│  [streak badge] 7 days      │
├─────────────────────────────┤
│                             │
│  ┌─── GLASS CARD ─────────┐ │
│  │  📊 Your Stats          │ │
│  │  Avg Score   Sessions   │ │
│  │    78%          12      │ │
│  │  Best Score  Streak     │ │
│  │    94%        7 days    │ │
│  └────────────────────────┘ │
│                             │
│  Recent Documents           │
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │ PDF  │ │ DOCX │ │  +  ││
│  │ Ch.3 │ │ Plan │ │Upload││
│  └──────┘ └──────┘ └──────┘│
│                             │
│  ┌─ [  Start New Quiz  ] ─┐ │ ← gradient button
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Key components:**
- Greeting with time-based emoji (☀️ morning, 🌙 night)
- Stats in a 2×2 glass card grid
- Horizontal document scroll with add button
- Large CTA with brand gradient fill

---

### Screen 2 — Document Upload

```
┌─────────────────────────────┐
│  ← Upload Documents         │
├─────────────────────────────┤
│                             │
│  ┌── Dashed Upload Zone ──┐ │
│  │                        │ │
│  │   [cloud-up icon 48px] │ │
│  │                        │ │
│  │  Tap to browse or      │ │
│  │  drag files here       │ │
│  │                        │ │
│  │  PDF · DOCX · TXT      │ │
│  └────────────────────────┘ │
│                             │
│  Uploaded (2)               │
│  ┌───────────────────────┐  │
│  │ 📄 Chapter_3.pdf  ✓   │  │  ← green check when processed
│  │    2.3 MB · 12 pages  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📄 Study_Notes.docx ⏳│  │  ← spinner when processing
│  │    456 KB · Processing│  │
│  └───────────────────────┘  │
│                             │
│  ┌─ [ Generate Questions ] ─┐│
└─────────────────────────────┘
```

**Upload zone code:**
```tsx
// Dashed upload border
borderStyle: 'dashed',
borderWidth: 2,
borderColor: colors.border.strong,
borderRadius: radius.xl,
// Animated pulse when dragging
// Use Animated.loop + Animated.sequence for border glow
```

---

### Screen 3 — Quiz / Question Screen (Hero Screen)

```
┌─────────────────────────────┐
│  Question 2 of 5     [Exit] │
│  ████████░░░░░░░░░░░  40%   │ ← animated progress bar
├─────────────────────────────┤
│                             │
│  [CONCEPTUAL] [MEDIUM]      │ ← pill badges
│                             │
│  ┌── GLASS CARD ──────────┐ │
│  │                        │ │
│  │  What is the primary   │ │  ← large, readable question
│  │  purpose of document   │ │     font: Syne 22px bold
│  │  embedding in a vector │ │
│  │  database?             │ │
│  │                        │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │                        │ │
│  │  🔊 [Tap to hear it]   │ │  ← TTS button
│  │                        │ │
│  └────────────────────────┘ │
│                             │
│  ─────── Your Answer ─────  │
│                             │
│  ┌── Voice Recorder ──────┐ │
│  │    ~~~~WAVEFORM~~~~    │ │  ← animated SVG waveform
│  │                        │ │
│  │       [  MIC  ]        │ │  ← large pulsing button
│  │   Hold to record       │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Mic button code:**
```tsx
// components/MicButton.tsx
const pulseAnim = useRef(new Animated.Value(1)).current

const startPulse = () => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
    ])
  ).start()
}

// Render
<Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
  <LinearGradient
    colors={['#6C63FF', '#A855F7', '#EC4899']}
    style={styles.micBtn}
  >
    <MicIcon size={32} color="#fff" />
  </LinearGradient>
</Animated.View>
```

---

### Screen 4 — Feedback / Results Screen (Most Visual)

```
┌─────────────────────────────┐
│  Your Answer                │
├─────────────────────────────┤
│                             │
│       ┌──────────┐          │
│       │   84%    │          │  ← animated circular score
│       │ ████████ │          │    color: green (≥80)
│       │ Excellent│          │
│       └──────────┘          │
│                             │
│  ┌── Score Breakdown ─────┐ │
│  │ Content     89%  ████  │ │
│  │ Speech      74%  ███░  │ │
│  └────────────────────────┘ │
│                             │
│  ✅ What you got right      │
│  ┌────────────────────────┐ │
│  │ • Semantic similarity  │ │
│  │ • Vector representation│ │
│  └────────────────────────┘ │
│                             │
│  ⚠️  What you missed        │
│  ┌────────────────────────┐ │
│  │ • Approximate nearest  │ │
│  │   neighbor search      │ │
│  └────────────────────────┘ │
│                             │
│  💡 Ideal Answer            │
│  ┌────────────────────────┐ │
│  │ [expandable card]      │ │  ← tap to reveal
│  └────────────────────────┘ │
│                             │
│  [← Previous] [Next →]     │
└─────────────────────────────┘
```

**Circular score animation:**
```tsx
// Animated circular progress using react-native-svg
import { AnimatedCircularProgress } from 'react-native-circular-progress'

<AnimatedCircularProgress
  size={120}
  width={10}
  fill={score}  // 0–100
  tintColor={getScoreColor(score)}
  backgroundColor={colors.bg.raised}
  rotation={0}
  duration={1200}
>
  {() => (
    <>
      <Text style={styles.scoreNum}>{score}%</Text>
      <Text style={styles.scoreLabel}>{getGrade(score)}</Text>
    </>
  )}
</AnimatedCircularProgress>
```

---

### Screen 5 — Session Summary

```
┌─────────────────────────────┐
│  Session Complete  🎉        │
├─────────────────────────────┤
│                             │
│     ┌──────────────────┐    │
│     │   Overall: 81%   │    │  ← big score
│     │   ⭐⭐⭐⭐☆       │    │  ← star rating
│     └──────────────────┘    │
│                             │
│  Performance Breakdown      │
│  ┌────────────────────────┐ │
│  │ Q1  What is embedding? │ │
│  │     ████████████ 92%   │ │
│  │ Q2  Explain chunking   │ │
│  │     ███████░░░░  74%   │ │
│  │ Q3  Vector similarity  │ │
│  │     █████░░░░░░  61%   │ │
│  └────────────────────────┘ │
│                             │
│  📌 Weak Topics to Review   │
│  ┌────────────────────────┐ │
│  │ • ANN search           │ │
│  │ • Cosine similarity    │ │
│  └────────────────────────┘ │
│                             │
│  [Retry Session] [Home]     │
└─────────────────────────────┘
```

---

## Navigation Design

```tsx
// navigation/TabNavigator.tsx
// Bottom tab bar — glass style

const tabBarStyle = {
  backgroundColor: 'rgba(18, 21, 28, 0.92)',
  borderTopColor: colors.border.subtle,
  borderTopWidth: 1,
  paddingBottom: 8,
  paddingTop: 8,
  height: 64,
}

// Tab icons (use lucide-react-native)
// Home      → LayoutDashboard
// Library   → BookOpen
// Analytics → TrendingUp
// Profile   → User
```

---

## Micro-Interaction Patterns

### 1. Screen Transition

```tsx
// All screens use slide-up or fade
// Using react-native-reanimated

entering={FadeInDown.duration(300).springify()}
exiting={FadeOutUp.duration(200)}
```

### 2. Button Press Feedback

```tsx
// All tappable elements scale slightly on press
// Add to every Pressable/TouchableOpacity

onPressIn={() => Animated.spring(scaleAnim, {
  toValue: 0.96,
  useNativeDriver: true
}).start()}
onPressOut={() => Animated.spring(scaleAnim, {
  toValue: 1.0,
  useNativeDriver: true
}).start()}
```

### 3. Waveform During Recording

```tsx
// SVG bars that animate height randomly
// 5–7 bars, each with different animation delay
// Color: brand gradient
const WaveformVisualizer = ({ isRecording }: { isRecording: boolean }) => {
  // Each bar: Animated.Value, loop between 4px–24px height
  // duration: 300–600ms random per bar
  // Only animate when isRecording === true
}
```

### 4. Score Counter Animation

```tsx
// Animated number count-up when score appears
// 0 → actual score over 1000ms
const animateScore = (target: number) => {
  const animation = Animated.timing(displayScore, {
    toValue: target,
    duration: 1000,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,  // number interpolation needs JS driver
  })
  animation.start()
}
```

### 5. Correct / Incorrect Toast

```tsx
// Bottom sheet that slides up briefly then fades
// Correct: green glass card with checkmark
// Incorrect: red/amber glass card with X
// Auto-dismiss after 2 seconds
```

---

## Component Library (Summary)

| Component | File | Use |
|---|---|---|
| `GlassCard` | `components/ui/GlassCard.tsx` | All cards |
| `ScreenBackground` | `components/ui/ScreenBackground.tsx` | Every screen wrapper |
| `GradientButton` | `components/ui/GradientButton.tsx` | Primary CTAs |
| `MicButton` | `components/quiz/MicButton.tsx` | Voice recording |
| `WaveformVisualizer` | `components/quiz/WaveformVisualizer.tsx` | Recording feedback |
| `CircularScore` | `components/feedback/CircularScore.tsx` | Score display |
| `ScoreBar` | `components/feedback/ScoreBar.tsx` | Content/speech breakdown |
| `FeedbackCard` | `components/feedback/FeedbackCard.tsx` | Correct/missed points |
| `QuestionCard` | `components/quiz/QuestionCard.tsx` | Question display |
| `DocumentCard` | `components/documents/DocumentCard.tsx` | File in list |
| `ProgressBar` | `components/quiz/ProgressBar.tsx` | Quiz progress |
| `BadgePill` | `components/ui/BadgePill.tsx` | Difficulty, type labels |

---

## Required Dependencies

```bash
# Install all at once
npx expo install \
  expo-blur \
  expo-linear-gradient \
  expo-av \
  react-native-svg \
  react-native-reanimated \
  react-native-circular-progress \
  @expo-google-fonts/syne \
  @expo-google-fonts/inter \
  lucide-react-native

npm install nativewind
```

---

## Inspiration References

| Source | What to steal |
|---|---|
| [Linear.app](https://linear.app) | Command palette, keyboard-first, dark glass panels |
| [Raycast](https://raycast.com) | Frosted glass, instant transitions, beautiful empty states |
| [Duolingo](https://duolingo.com) | Streak mechanics, feedback celebration, streak loss prevention |
| [Perplexity](https://perplexity.ai) | Mobile AI interaction, streaming text, source cards |
| [Vercel Dashboard](https://vercel.com/dashboard) | Data density, clean metrics, micro-typography |
| [Reflect.app](https://reflect.app) | Document UI, linking, clean text editing |

---

## Dark Mode Note

This app is **dark-mode only** — no light mode needed.  
Rationale: voice + AI-heavy sessions work better in low-light environments (study sessions, late night review).  
Use `Appearance.getColorScheme()` to detect system preference; always return dark assets.

---

*Design System v1.0 — AI Document Quiz App*  
*Tooling: Expo + NativeWind + react-native-reanimated + expo-blur*
