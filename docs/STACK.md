# AI Quiz App — Technology Stack

Full breakdown of every library, service, and pattern used in the project, grouped by layer, with the reason each was chosen.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Backend](#3-backend)
   - [Runtime & Framework](#31-runtime--framework)
   - [Database Layer](#32-database-layer)
   - [AI Services](#33-ai-services)
   - [File Processing](#34-file-processing)
   - [Authentication & Security](#35-authentication--security)
   - [Validation & Utilities](#36-validation--utilities)
   - [Dev Tooling](#37-dev-tooling)
4. [Frontend](#4-frontend)
   - [Framework & Runtime](#41-framework--runtime)
   - [Navigation](#42-navigation)
   - [State Management](#43-state-management)
   - [HTTP & API](#44-http--api)
   - [UI & Styling](#45-ui--styling)
   - [Audio](#46-audio)
   - [Storage](#47-storage)
5. [AI / ML Pipeline](#5-ai--ml-pipeline)
6. [Data Models](#6-data-models)
7. [API Surface](#7-api-surface)
8. [Environment Configuration](#8-environment-configuration)

---

## 1. Project Overview

AI Quiz App is a mobile application that turns any document (PDF, DOCX, TXT) into an interactive interview practice session. Users upload study material, the AI generates interview-style questions, the user answers by voice, and the system evaluates both content quality and speech delivery with a composite score.

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) |
| Backend API | Node.js + Express |
| Primary DB | MongoDB Atlas |
| Vector DB | LanceDB |
| Text AI | Groq (LLaMA 3.3 70B) |
| Vision / Embeddings | Google Gemini |
| Speech-to-Text | Groq Whisper |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────┐
│          React Native App           │
│  Expo Router · Zustand · React Query│
│  expo-av · expo-document-picker     │
└──────────────┬──────────────────────┘
               │ HTTPS / REST
               ▼
┌─────────────────────────────────────┐
│          Express API Server         │
│  Auth · Documents · Sessions        │
│  Questions · Voice · Feedback       │
│  Analytics · Daily Quest            │
└──────┬──────────────┬───────────────┘
       │              │
       ▼              ▼
  MongoDB Atlas    LanceDB (local)
  User accounts    Sessions + Embeddings
  Daily quest      Vector similarity search
  Documents meta   Answer transcripts
       │
       ▼
  AI Services
  ├── Groq  → LLaMA 3.3-70B  (question gen, evaluation, daily quest)
  ├── Groq  → Whisper large-v3 (speech-to-text)
  └── Gemini → embedding-001  (768-dim vectors)
              → vision        (scanned PDF OCR fallback)
```

---

## 3. Backend

### 3.1 Runtime & Framework

| Package | Version | Purpose |
|---|---|---|
| **Node.js** | ≥18 | JavaScript runtime — chosen for its non-blocking I/O, ideal for API servers that call external AI services concurrently |
| **Express** | ^4.19.2 | Minimal HTTP framework — provides routing, middleware pipeline, and error handling without forcing a specific structure |
| **cors** | ^2.8.5 | Middleware that sets `Access-Control-Allow-*` headers so the mobile app can reach the API from any IP during development |
| **dotenv** | ^16.4.5 | Loads `.env` files into `process.env` at startup so API keys and connection strings never live in source code |

**Entry point:** `backend/src/app.js`

The app boots in this order:
1. Load `.env`
2. Connect to MongoDB (non-blocking — server starts even if DB is slow)
3. Register middleware: CORS → `express.json()` → `express.urlencoded()`
4. Mount routes with the auth middleware on all protected paths
5. Attach global 404 and error handlers

---

### 3.2 Database Layer

#### MongoDB + Mongoose

| Package | Version | Purpose |
|---|---|---|
| **mongoose** | ^9.4.1 | ODM (Object Document Mapper) for MongoDB — provides schema validation, type coercion, hooks, and query building |

**Why MongoDB:** Document-oriented storage suits the project's varied schemas (users, uploaded files, daily quest plans, answer histories). Schema-less flexibility allows adding new fields without migrations.

**Collections:**

| Model | File | Key Fields |
|---|---|---|
| `User` | `models/User.js` | `name`, `email`, `passwordHash`, `stats` (avgScore, bestScore, streak, totalSessions) |
| `Document` | `models/Document.js` | `userId`, `fileName`, `wordCount`, `charCount`, `text`, `status` (processing / ready / failed) |
| `DailyQuestPlan` | `models/DailyQuestPlan.js` | `userId`, `date` (UTC day), `questions[]` — one plan per user per day, compound unique index on `(userId, date)` |
| `DailyQuestEntry` | `models/DailyQuestEntry.js` | `userId`, `planId`, `questionId`, `userAnswer`, `isCorrect`, `score`, `feedback` — idempotent via compound unique index on `(userId, planId, questionId)` |

#### LanceDB — Vector Database

| Package | Version | Purpose |
|---|---|---|
| **@lancedb/lancedb** | ^0.27.2 | Embedded vector database — stores session data alongside 768-dimensional embedding vectors for semantic search |

**Why LanceDB:** Runs in-process without a separate server (data lives in `./data/lancedb/`), making it zero-infrastructure for vector similarity search. It stores each session as a row with a `vector` column used for finding similar past sessions (RAG-based feedback improvement).

**Operations (`services/lanceDb.js`):**

| Function | What it does |
|---|---|
| `createSession()` | Embeds first 2000 chars of the document, stores session row |
| `read(id)` | Fetch session by UUID |
| `saveAnswer(sessionId, questionId, transcript)` | Upsert a single question's transcript into the answers array |
| `completeSession(sessionId, feedback)` | Mark done, attach overall feedback + score |
| `listSessions(userId)` | Return all sessions newest-first (no large text fields) |
| `findSimilarSessions(text, limit)` | ANN vector search — finds semantically similar past sessions |

---

### 3.3 AI Services

All AI calls are centralized in `backend/src/services/geminiService.js`.

#### Groq — Text Generation & Speech-to-Text

| SDK | Version | Models Used |
|---|---|---|
| **groq-sdk** | ^1.1.2 | `llama-3.3-70b-versatile` (primary), `llama3-70b-8192` (fallback), `whisper-large-v3` (STT) |

**Why Groq:** Extremely fast inference (token streaming, low latency) — critical for real-time question generation and audio transcription. Has a generous free tier (14,400 requests/day).

| Function | Model | Purpose |
|---|---|---|
| `generateText(prompt)` | llama-3.3-70b-versatile | Question generation, answer evaluation, daily quest generation, feedback analysis |
| `transcribeAudio(filePath)` | whisper-large-v3 | Converts user's voice recording (m4a/wav) to text for evaluation |

**Retry logic:** Auto-retries on 429 (rate limit) with exponential backoff, detects daily quota exhaustion and throws a clear error.

#### Google Gemini — Vision & Embeddings

| SDK | Version | Models Used |
|---|---|---|
| **@google/generative-ai** | ^0.21.0 | `gemini-2.0-flash` / `gemini-1.5-flash` (vision), `embedding-001` (embeddings) |

**Why Gemini:** The only API that provides both multimodal vision (for scanned PDF OCR) and high-quality 768-dim text embeddings in one SDK.

| Function | Model | Purpose |
|---|---|---|
| `generateFromFile(prompt, buffer, mimeType)` | gemini-2.0-flash | Last-resort OCR for image-based / scanned PDFs that pdf-parse cannot read |
| `embedText(text)` | embedding-001 | Generates 768-dim vector for a document excerpt, used by LanceDB for session storage and similarity search |

#### AI Prompt Templates

`backend/src/prompts/templates.js` — All prompts are kept here, away from route logic:

| Template | Purpose |
|---|---|
| `generateQuestionsPrompt()` | Instructs LLaMA to produce `n` interview questions with hints, type, and difficulty |
| `singleAnswerEvalPrompt()` | Evaluates one transcribed answer against the question — returns score 1-10, strengths, improvements, suggested phrasing |
| `feedbackPrompt()` | Full-session feedback — produces overall score, dimensions (clarity, confidence, relevance, grammar, vocabulary), per-question breakdown, top tips |
| `dailyQuestPrompt()` | Generates 5 daily practice questions across topics with correct answers and grading tips |
| `evaluateDailyAnswerPrompt()` | Grades a typed answer against the correct answer for daily quest |

---

### 3.4 File Processing

| Package | Version | Purpose |
|---|---|---|
| **multer** | ^2.1.1 | Parses `multipart/form-data` requests — used for both document uploads and audio uploads. Saves files to disk temporarily (`uploads/documents/` or `uploads/audio/`) |
| **pdf-parse** | ^1.1.1 | Extracts raw text from PDF files. Fast and works well for text-based PDFs |
| **mammoth** | ^1.8.0 | Converts `.docx` files to plain text by stripping formatting. More reliable than raw XML parsing |

**Document extraction flow** (`services/documentParser.js`):

```
Input file
   │
   ├─ .txt → Read directly with fs.readFileSync
   │
   ├─ .docx → mammoth.extractRawText()
   │
   └─ .pdf  → pdf-parse()
                 │
                 ├─ ≥100 chars of text → return as-is
                 │
                 ├─ 20-99 chars → Groq LLaMA cleanup (improve noisy extracts)
                 │
                 └─ <20 chars  → Gemini Vision OCR (scanned/image PDF)
                                   └─ still empty → 422 Unprocessable
```

**Audio upload** (`middleware/audioUpload.js`): Accepts m4a, wav, mp3, webm, ogg, flac — max 25 MB. Files are deleted immediately after Whisper transcription.

---

### 3.5 Authentication & Security

| Package | Version | Purpose |
|---|---|---|
| **bcrypt** | ^6.0.0 | Hashes user passwords with salt rounds (10) before storing in MongoDB. Never stores plaintext |
| **jsonwebtoken** | ^9.0.3 | Creates and verifies HS256 JWTs. Tokens are sent in `Authorization: Bearer <token>` headers |

**Auth flow:**
1. Register → hash password → save User → sign JWT → return token
2. Login → lookup by email → `bcrypt.compare()` → sign JWT → return token
3. Protected routes → `authMiddleware` extracts token from header → `jwt.verify()` → attaches `req.userId`

---

### 3.6 Validation & Utilities

| Package | Version | Purpose |
|---|---|---|
| **zod** | ^4.3.6 | Schema validation library — available for future route input validation |
| **uuid** | ^10.0.0 | Generates v4 UUIDs for session IDs stored in LanceDB (MongoDB uses its own ObjectId) |

---

### 3.7 Dev Tooling

| Package | Version | Purpose |
|---|---|---|
| **nodemon** | ^3.1.4 | Watches `src/` for changes and auto-restarts the Express server during development |
| **concurrently** | ^9.2.1 | Runs the backend and (optionally) frontend dev servers from a single `npm run dev` command in the root |

---

## 4. Frontend

### 4.1 Framework & Runtime

| Package | Version | Purpose |
|---|---|---|
| **React Native** | 0.81.5 | Cross-platform mobile framework — one codebase for iOS and Android |
| **Expo** | ~54.0.34 | Managed workflow on top of React Native — handles native builds, permissions, OTA updates, and provides a large library of pre-built native modules |
| **TypeScript** | ~5.9.2 | Type safety across all components, API types, and store actions |

**Expo config (`app.json`):**
- New Architecture enabled (Fabric renderer + TurboModules) for better performance
- Portrait-only orientation
- Dark UI style (matches the app's `#0A0B0F` background)
- Permissions: `NSMicrophoneUsageDescription` (iOS), `RECORD_AUDIO` (Android)

---

### 4.2 Navigation

| Package | Version | Purpose |
|---|---|---|
| **expo-router** | ~6.0.23 | File-based routing — every file in `app/` becomes a route automatically, same pattern as Next.js. Eliminates manual navigator configuration |
| **react-native-screens** | ~4.16.0 | Native screen containers for better memory management (screens are truly unmounted when navigated away) |
| **react-native-gesture-handler** | ~2.28.0 | Required peer dependency for React Navigation / Expo Router swipe and gesture interactions |

**Route structure:**

```
app/
├── (auth)/
│   ├── login.tsx        → /(auth)/login
│   └── register.tsx     → /(auth)/register
├── (tabs)/
│   ├── _layout.tsx      → Tab bar configuration
│   ├── index.tsx        → /  (Home — stats dashboard)
│   ├── upload.tsx       → /upload
│   ├── sessions.tsx     → /sessions
│   ├── analytics.tsx    → /analytics
│   └── daily.tsx        → /daily
├── session/
│   ├── new.tsx          → /session/new
│   ├── [id].tsx         → /session/:id  (question viewer)
│   └── result.tsx       → /session/result
└── daily-quest/
    └── history.tsx      → /daily-quest/history
```

**Auth guard:** `(tabs)/_layout.tsx` checks `useAuthStore().isAuthenticated` and redirects to `/(auth)/login` if not logged in.

---

### 4.3 State Management

| Package | Version | Purpose |
|---|---|---|
| **zustand** | ^5.0.12 | Lightweight global state — used for auth (token, user object, login/logout/restore actions). No boilerplate compared to Redux |
| **@tanstack/react-query** | ^5.99.2 | Server state management — handles caching, background refetch, and loading/error states for API calls |

**`store/authStore.ts` (Zustand):**

| State | Type | Description |
|---|---|---|
| `token` | `string \| null` | JWT access token |
| `user` | `User \| null` | Full user object including stats |
| `isLoading` | `boolean` | True during initial session restore |
| `isAuthenticated` | `boolean` | Derived from token presence |

| Action | Description |
|---|---|
| `login(email, password)` | Calls API, saves token to SecureStore, sets state |
| `register(name, email, password)` | Same as login flow |
| `logout()` | Clears SecureStore, resets state |
| `restoreSession()` | Called on app launch — reads SecureStore, validates via `/me`, clears on 401 |
| `refreshUser()` | Silent re-fetch of `/me` to update stats after a session completes |

---

### 4.4 HTTP & API

| Package | Version | Purpose |
|---|---|---|
| **axios** | ^1.15.0 | HTTP client with interceptors — request interceptor attaches JWT, response interceptor logs errors centrally |

**`services/api.ts`** is the single source of truth for all API calls.

- Base URL: `EXPO_PUBLIC_API_BASE_URL` env var (falls back to `http://localhost:3000`)
- File uploads (documents, audio) use native `fetch` with `FormData` — Axios does not handle React Native's `uri`-based file objects correctly
- All other calls use the Axios instance

**API modules:**

| Module | Endpoints |
|---|---|
| `authApi` | `register`, `login`, `me` |
| `documentsApi` | `upload` (native fetch), `list`, `get(id)` |
| `questionsApi` | `generate` |
| `sessionsApi` | `create`, `list`, `get(id)`, `answer`, `complete` |
| `feedbackApi` | `generate(sessionId)` |
| `analyticsApi` | `performance` |
| `voiceAnswerApi` | `submit` (native fetch — sends audio file + questionId) |
| `dailyQuestApi` | `today`, `submit`, `history` |

---

### 4.5 UI & Styling

| Package | Version | Purpose |
|---|---|---|
| **expo-linear-gradient** | ~15.0.8 | Full-bleed gradient backgrounds on every screen (`#0A0B0F → #0D1018 → #0A0B0F`) |
| **react-native-safe-area-context** | ~5.6.0 | Provides `SafeAreaView` with an `edges` prop — wraps screen content to avoid the status bar and home indicator |
| **@expo/vector-icons** | ^15.1.1 | Icon set — Ionicons used for tab bar icons |
| **expo-blur** | ~15.0.8 | Blur effect component (available for future use) |
| **react-native-reanimated** | ~4.1.1 | High-performance animations running on the UI thread (worklets) — used for the score ring spring animation on the result screen |
| **react-native-worklets** | 0.5.1 | Required peer dependency for reanimated worklets |

**Design system files (`frontend/constants/`):**

| File | What it defines |
|---|---|
| `colors.ts` | `colors.bg.*`, `colors.text.*`, `colors.border.*`, `colors.accent.*`, `getScoreColor()` |
| `typography.ts` | `typography.scale.*` (xs → 3xl), `typography.weights.*` |
| `spacing.ts` | `spacing.*` (xs → 3xl), `radius.*`, `screenPadding` |

**SafeAreaView pattern used throughout the app:**
```tsx
// Tab screens (React Navigation handles bottom)
<LinearGradient style={styles.bg}>
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView>...</ScrollView>
  </SafeAreaView>
</LinearGradient>

// Stack screens (no tab bar below)
<LinearGradient style={styles.bg}>
  <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <ScrollView>...</ScrollView>
  </SafeAreaView>
</LinearGradient>
```

---

### 4.6 Audio

| Package | Version | Purpose |
|---|---|---|
| **expo-av** | ~16.0.8 | Audio recording and playback — `Audio.Recording` captures the user's voice answer, `Audio.Sound` plays it back before submission |

**VoiceRecorder component state machine:**

```
idle → recording → recorded → submitting → done
        ↑               │
        └───────────────┘ (re-record)
```

- Recording format: `m4a` (iOS) / `webm` (Android) via `Audio.RecordingOptionsPresets.HIGH_QUALITY`
- Animated pulse ring plays during recording
- Timer counts up during recording

---

### 4.7 Storage

| Package | Version | Purpose |
|---|---|---|
| **expo-secure-store** | ~15.0.8 | Encrypted key-value store backed by iOS Keychain and Android Keystore — used to persist the JWT token between app launches |
| **expo-document-picker** | ~14.0.8 | Native OS file picker — allows users to select PDF, DOCX, or TXT files from Files / Drive / iCloud |
| **expo-file-system** | ~19.0.22 | File system access — available for reading/writing local files if needed |
| **expo-constants** | ~18.0.13 | Exposes `app.json` values and device constants at runtime |
| **expo-linking** | ~8.0.12 | Deep link handling for custom URL schemes |

---

## 5. AI / ML Pipeline

### Question Generation

```
User selects document + count + type + difficulty
         │
         ▼
GET /api/documents/:id → extractedText
         │
         ▼
POST /api/questions/generate
  → generateQuestionsPrompt(text, count, type, difficulty)
  → Groq LLaMA 3.3-70B
  → Parse JSON array of { text, type, difficulty, hint[], modelAnswer }
         │
         ▼
POST /api/sessions  → store in LanceDB with embedding vector
```

### Voice Answer Evaluation

```
User records audio (expo-av)
         │
         ▼
POST /api/sessions/:id/voice-answer  (multipart/form-data)
         │
         ├─ Groq Whisper → transcript (text)
         │
         ├─ analyzeSpeech(transcript)
         │    ├── WPM (words per minute)
         │    ├── Filler word count (um, uh, like, you know…)
         │    └── Vocabulary diversity (unique/total word ratio)
         │
         ├─ computeSpeechScore(speechQuality) → 0-100
         │    Weights: WPM 40% + fillers 35% + vocabulary 25%
         │
         ├─ singleAnswerEvalPrompt(question, transcript, hints)
         │    → Groq LLaMA → { score 1-10, strengths[], improvements[], suggestedPhrase }
         │    → contentScore = score × 10  (0-100)
         │
         └─ compositeScore = contentScore × 0.70 + speechScore × 0.30
```

### Session Feedback (End of Session)

```
POST /api/feedback/:sessionId
         │
         ├─ Load session from LanceDB (all answer transcripts)
         │
         ├─ feedbackPrompt(questions, answers)
         │    → Groq LLaMA → {
         │         overall, grade, summary,
         │         dimensions: { clarity, confidence, relevance, grammar, vocabulary },
         │         questions[]: { id, score, strengths[], improvements[], suggestedPhrase },
         │         topTips[]
         │       }
         │
         ├─ completeSession() → store feedback in LanceDB
         │
         └─ Update MongoDB User.stats
              (avgScore, bestScore, streak, totalSessions)
```

### Daily Quest

```
GET /api/daily-quest/today
         │
         ├─ Check DailyQuestPlan for today's UTC date
         │
         ├─ If not found:
         │    dailyQuestPrompt() → Groq LLaMA
         │    → 5 questions with topic, difficulty, correctAnswer, tips[]
         │    → Create DailyQuestPlan in MongoDB
         │
         └─ Return plan with answered status per question

POST /api/daily-quest/submit
         │
         ├─ evaluateDailyAnswerPrompt(question, userAnswer, correctAnswer, tips)
         │    → Groq LLaMA → { isCorrect, score, feedback, correctAnswer, tips }
         │
         └─ Save DailyQuestEntry (idempotent — unique index prevents double submit)
```

---

## 6. Data Models

### User

```js
{
  name:         String,      // Display name
  email:        String,      // Unique, indexed
  passwordHash: String,      // bcrypt hash
  stats: {
    totalSessions:  Number,  // Completed sessions count
    avgScore:       Number,  // Rolling average score 0-100
    totalQuestions: Number,  // All questions attempted
    totalAnswered:  Number,  // Questions with answers
    streak:         Number,  // Consecutive days with a session
    bestScore:      Number,  // Highest single-session score
    lastSessionDate: Date,
  },
  lastLoginAt:  Date,
  timestamps:   true,
}
```

### Document

```js
{
  userId:    ObjectId,       // ref: User
  fileName:  String,         // Decoded original filename
  wordCount: Number,
  charCount: Number,
  text:      String,         // Full extracted text (not returned in list queries)
  status:    'processing' | 'ready' | 'failed',
  timestamps: true,
}
```

### Session (LanceDB)

```js
{
  id:            String,     // UUID v4
  userId:        String,
  documentName:  String,
  interviewType: String,     // technical / behavioral / hr / mixed
  difficulty:    String,     // junior / mid / senior
  questions:     JSON,       // Array of { id, text, type, difficulty, hint[], modelAnswer }
  answers:       JSON,       // Map of questionId → { transcript, contentScore, speechScore, compositeScore }
  status:        'in_progress' | 'completed',
  score:         Number,     // 0-100, set on completion
  feedback:      JSON,       // Full FeedbackResult from Groq
  vector:        Float32[768], // Gemini embedding of document text
  createdAt:     String,
}
```

### DailyQuestPlan

```js
{
  userId: ObjectId,
  date:   Date,              // UTC midnight — used for "today" lookup
  questions: [{
    id:            Number,
    question:      String,
    correctAnswer: String,
    tips:          [String],
    topic:         String,
    difficulty:    'easy' | 'medium' | 'hard',
    answered:      Boolean,
    entryId:       ObjectId, // ref: DailyQuestEntry, set after submission
  }],
  // Unique index on (userId, date)
}
```

---

## 7. API Surface

All endpoints are prefixed with `/api`. Protected endpoints require `Authorization: Bearer <JWT>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Get JWT token |
| GET | `/auth/me` | ✓ | Current user + stats |
| POST | `/documents/upload` | ✓ | Upload PDF/DOCX/TXT |
| GET | `/documents` | ✓ | List user's documents |
| GET | `/documents/:id` | ✓ | Get document including text |
| POST | `/questions/generate` | ✓ | AI question generation |
| POST | `/sessions` | ✓ | Create session |
| GET | `/sessions` | ✓ | List sessions |
| GET | `/sessions/:id` | ✓ | Get session |
| PUT | `/sessions/:id/answer` | ✓ | Save typed/skipped answer |
| POST | `/sessions/:id/complete` | ✓ | Mark session done |
| POST | `/sessions/:id/voice-answer` | ✓ | Submit audio, get evaluation |
| POST | `/feedback/:sessionId` | ✓ | Generate full session feedback |
| GET | `/analytics/performance` | ✓ | Score history + trends |
| GET | `/daily-quest/today` | ✓ | Today's 5 questions |
| POST | `/daily-quest/submit` | ✓ | Submit daily answer |
| GET | `/daily-quest/history` | ✓ | Past days grouped by date |
| GET | `/health` | — | Server health check |

---

## 8. Environment Configuration

### Backend `.env`

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/aiquizapp
JWT_SECRET=<base64-encoded-secret>
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Defaults to 3000 |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs — use a long random string |
| `GROQ_API_KEY` | Yes | From console.groq.com — free tier: 14,400 req/day |
| `GEMINI_API_KEY` | Yes | From aistudio.google.com — used for embeddings and vision OCR |

### Frontend `.env`

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Backend URL reachable from the physical device. Must use the machine's LAN IP (not localhost) when testing on a real phone |

> **Note:** All `EXPO_PUBLIC_*` variables are baked into the JS bundle at build time and are visible to users. Never put secrets here.
