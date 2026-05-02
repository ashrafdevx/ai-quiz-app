# Quizly — AI-Powered Interview & Quiz Practice

A mobile app that turns any document into an interactive quiz or AI interview session. Upload a PDF, Word doc, or voice note and Quizly generates questions, evaluates your answers, and tracks your progress over time.

---

## Features

- **Document Quiz** — upload a PDF/DOCX and get AI-generated quiz questions with instant feedback and scoring
- **AI Interview Practice** — ChatGPT-style chat interface that asks interview questions on any topic, evaluates answers in real time, and gives detailed improvement tips
- **Voice Input** — record an audio note; Groq Whisper transcribes it into a document you can quiz yourself on
- **Daily Challenge** — a fresh set of questions every day to build a study streak
- **Analytics** — track avg score, best score, total sessions, and daily streak
- **Session History** — unified feed of quiz, interview, and daily sessions with expandable accordion cards
- **Dark / Light theme** — system-aware with manual toggle

---

## Tech Stack

### Frontend
| | |
|---|---|
| Framework | React Native (Expo SDK 54) |
| Navigation | Expo Router (file-based) |
| State | Zustand |
| Data fetching | TanStack React Query |
| Animations | React Native Reanimated 4 |
| Audio | expo-av |
| UI | expo-linear-gradient, @expo/vector-icons |
| Auth storage | expo-secure-store |

### Backend
| | |
|---|---|
| Runtime | Node.js + Express |
| Database | MongoDB (Mongoose) — users, documents, interview sessions, daily quests |
| Vector store | LanceDB (local) — quiz sessions with Gemini embeddings |
| AI | Google Gemini (questions, feedback, embeddings) + Groq (chat completions, Whisper transcription) |
| Auth | JWT (Bearer token) |
| File parsing | pdf-parse, mammoth (DOCX) |
| File uploads | multer |
| Deployment | Railway (backend) + EAS (mobile builds) |

---

## Project Structure

```
ai-quiz-app/
├── backend/
│   └── src/
│       ├── app.js                  # Express app + route mounts
│       ├── server.js               # Entry point
│       ├── config/                 # DB connection
│       ├── middleware/             # Auth (JWT verify)
│       ├── models/                 # Mongoose schemas
│       │   ├── User.js
│       │   ├── Document.js
│       │   ├── InterviewSession.js
│       │   ├── DailyQuestPlan.js
│       │   └── DailyQuestEntry.js
│       ├── routes/                 # REST endpoints
│       │   ├── auth.js             # /api/auth
│       │   ├── documents.js        # /api/documents
│       │   ├── sessions.js         # /api/sessions (quiz)
│       │   ├── interview.js        # /api/interview
│       │   ├── feedback.js         # /api/feedback
│       │   ├── dailyQuest.js       # /api/daily-quest
│       │   ├── analytics.js        # /api/analytics
│       │   └── questions.js        # /api/questions
│       ├── services/
│       │   ├── geminiService.js    # Gemini AI + Whisper transcription
│       │   ├── lanceDb.js          # Vector store for quiz sessions
│       │   └── documentParser.js  # PDF / DOCX text extraction
│       └── prompts/
│           └── templates.js        # All AI prompt templates
└── frontend/
    └── app/
        ├── (auth)/                 # login, register
        ├── (tabs)/                 # bottom tab screens
        │   ├── index.tsx           # Home
        │   ├── upload.tsx          # Document upload
        │   ├── sessions.tsx        # Session history
        │   ├── daily.tsx           # Daily challenge
        │   └── analytics.tsx       # Progress charts
        ├── interview.tsx           # AI interview chat screen
        ├── audio-record.tsx        # Voice recording screen
        └── session/                # Quiz session screens
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance (local or Atlas)
- Expo CLI (`npm install -g expo-cli`)
- API keys: **Gemini** (`GEMINI_API_KEY`) and **Groq** (`GROQ_API_KEY`)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your keys
npm run dev
```

Required `.env` variables:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/quizly
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm start          # opens Expo Dev Tools
```

Required `.env` variables:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-url
```

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| POST | `/api/documents` | Upload PDF/DOCX |
| POST | `/api/documents/transcribe` | Transcribe audio → text |
| POST | `/api/documents/from-text` | Save raw text as document |
| POST | `/api/sessions` | Create quiz session |
| GET | `/api/sessions` | List user's quiz sessions |
| PUT | `/api/sessions/:id/answer` | Save answer to question |
| POST | `/api/sessions/:id/complete` | Mark session complete |
| POST | `/api/interview/start` | Start AI interview on a topic |
| POST | `/api/interview/:id/answer` | Submit text answer |
| POST | `/api/interview/:id/voice` | Submit voice answer |
| POST | `/api/interview/:id/next` | Get next question |
| POST | `/api/interview/:id/complete` | End interview, get stats |
| GET | `/api/interview` | List user's interview sessions |
| GET | `/api/daily-quest` | Get today's challenge |
| GET | `/api/analytics` | Get user stats |

All endpoints except auth require `Authorization: Bearer <token>`.

---

## Deployment

### Backend (Railway)
The backend is deployed on Railway via Docker. Push to `main` triggers an automatic redeploy.

> **Note:** LanceDB stores quiz session vectors on the local filesystem (`./data/lancedb/`). This data is ephemeral on Railway — it clears on every redeploy. Quiz session metadata is unaffected (stored in MongoDB).

### Mobile (EAS)
```bash
# OTA update (JS changes only — no rebuild needed)
eas update --branch preview

# Full build (required when native code or assets change)
eas build --platform android --profile preview
```
