# AI Document Quiz App — Master Project Prompt

> **Usage:** Paste this entire file as context when starting a new Claude session for this project.  
> **Stack:** React Native · Node.js/Express · Python FastAPI · MongoDB · ChromaDB · Claude API

---

## 1. Project Overview

Build a cross-platform mobile application (iOS + Android) using **React Native** that allows users to:

1. Upload one or multiple documents (PDF, DOCX, TXT, images via OCR)
2. Have an AI extract, embed, and semantically index the content
3. Receive AI-generated questions based on document content
4. Answer questions via **voice input**
5. Receive real-time evaluation of:
   - Answer correctness (semantic accuracy)
   - English speaking quality (fluency, grammar, pronunciation confidence)
6. Review feedback, ideal answers, and track personal performance over time

**Target users:** Students, professionals preparing for interviews, language learners, and anyone doing document-based revision.

---

## 2. Feature Specification

### 2.1 Core Features (MVP)

| Feature | Description |
|---|---|
| Document Upload | Support PDF, DOCX, TXT; multi-file batch upload |
| AI Question Generation | Context-aware questions: factual, conceptual, inferential |
| Voice Answer Input | Record answer via mic; display live transcript |
| Answer Evaluation | Semantic similarity + LLM-based grading |
| Speech Quality Rating | Fluency, filler word detection, confidence score |
| Feedback Display | Correct answer, explanation, what user got right/wrong |
| Session History | View past sessions, scores, and improvement trends |

### 2.2 Extended Features (Post-MVP)

| Feature | Description |
|---|---|
| Question Difficulty Levels | Easy / Medium / Hard toggle per session |
| Study Mode vs Exam Mode | Hints allowed vs strict evaluation |
| Spaced Repetition | Re-surface weak topics using SM-2 algorithm |
| Leaderboard / Gamification | Streaks, badges, XP points |
| Multi-language Support | Non-English documents + multilingual voice input |
| Export Report | PDF summary of session performance |
| Collaborative Sessions | Share document sets with peers |
| OCR for Images | Extract text from scanned documents or photos |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Native App (Client)               │
│  Upload UI · Voice Recorder · Question UI · Dashboard   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│              API Gateway (Node.js / Express)             │
│  Auth · Rate Limiting · Request Routing · File Handling  │
└────┬──────────────────┬───────────────────┬─────────────┘
     │                  │                   │
┌────▼────┐      ┌──────▼──────┐    ┌───────▼──────┐
│ MongoDB │      │  AI Service │    │  ChromaDB    │
│Sessions │      │(Python/Fast)│    │  (Vectors)   │
│Users    │      │             │    │              │
│Docs     │      │ ┌─────────┐ │    └──────────────┘
│History  │      │ │ Claude  │ │
└─────────┘      │ │   API   │ │
                 │ └─────────┘ │
                 │ ┌─────────┐ │
                 │ │Whisper/ │ │
                 │ │Assembly │ │
                 │ └─────────┘ │
                 └─────────────┘
```

---

## 4. Tech Stack Decisions

### 4.1 Frontend — React Native

```
react-native                  # Core framework
expo (managed workflow)       # Easier builds, OTA updates
expo-document-picker          # File selection (PDF/DOCX)
expo-av / react-native-audio-recorder-player  # Voice recording
@tanstack/react-query         # Server state management
zustand                       # Local/global UI state
react-native-reanimated       # Smooth animations
nativewind                    # Tailwind-style styling
react-navigation              # Stack + Tab navigation
expo-speech                   # TTS for reading questions aloud
```

### 4.2 Backend — Node.js / Express (API Gateway)

```
express                       # REST API framework
multer                        # File upload handling
mongoose                      # MongoDB ODM
jsonwebtoken + bcrypt         # Auth (JWT)
socket.io                     # Real-time feedback streaming
axios                         # Forward requests to AI service
zod                           # Request validation
winston                       # Logging
```

### 4.3 AI Service — Python / FastAPI

```
fastapi                       # Async Python API
anthropic                     # Claude API SDK (question gen + eval)
langchain                     # Document chunking + pipeline orchestration
chromadb                      # Vector store (local or hosted)
sentence-transformers         # Embeddings (all-MiniLM-L6-v2 or better)
pypdf2 / pdfplumber           # PDF parsing
python-docx                   # DOCX parsing
pytesseract + Pillow          # OCR for image-based documents
openai-whisper / assemblyai   # Speech-to-text
boto3 / google-cloud-storage  # File storage (S3 or GCS)
```

### 4.4 Databases

| Database | Role |
|---|---|
| **MongoDB Atlas** | Users, sessions, document metadata, history, scores |
| **ChromaDB** | Document embeddings + semantic search |
| **Redis** (optional) | Caching frequent queries, session tokens |

---

## 5. Data Flow — Step by Step

### Step 1: Document Upload & Processing

```
User selects file(s) in app
  → React Native: POST /api/documents (multipart/form-data)
  → Node.js: validates file, stores to S3, saves metadata to MongoDB
  → Node.js: triggers AI Service: POST /process-document
  → FastAPI:
      1. Downloads file from S3
      2. Parses text (PDFPlumber / python-docx / Tesseract)
      3. Chunks text (LangChain RecursiveCharacterTextSplitter)
      4. Embeds chunks (sentence-transformers)
      5. Stores embeddings in ChromaDB (collection per document)
      6. Returns: { documentId, chunkCount, status }
  → Node.js: updates MongoDB document status → "processed"
  → App: shows "Ready to Quiz" UI
```

### Step 2: Question Generation

```
User taps "Start Quiz"
  → React Native: POST /api/sessions (documentIds[], difficulty, questionCount)
  → Node.js: creates session in MongoDB, calls AI Service
  → FastAPI:
      1. Retrieves top-N relevant chunks from ChromaDB
      2. Calls Claude API with structured prompt:
         - System: "You are a quiz generator. Generate {n} questions..."
         - User: "<document_chunks> Generate questions at {difficulty} level..."
      3. Claude returns JSON: [{question, type, expectedKeywords, idealAnswer}]
      4. Returns questions array to Node.js
  → Node.js: saves questions to session, returns to app
  → App: displays first question, optionally speaks it via TTS
```

### Step 3: Voice Answer & Evaluation

```
User records voice answer
  → React Native: POST /api/answers (audioBlob, questionId, sessionId)
  → Node.js: forwards audio to AI Service
  → FastAPI:
      1. Speech-to-Text: Whisper/AssemblyAI → transcribedText
      2. Speech Quality Analysis:
         - Word count, WPM, filler word detection ("um", "uh", "like")
         - Confidence score from Whisper
         - Grammar check (LanguageTool API)
      3. Answer Evaluation via Claude:
         - Semantic similarity: embeddings cosine similarity vs ideal answer
         - LLM grading: Claude evaluates correctness, completeness, relevance
         - Returns: { score, feedback, missedPoints, correctPoints }
      4. Composite scoring:
         - Content score (70%) + Speech quality (30%)
  → Node.js: saves result to MongoDB session
  → App: displays score, feedback, ideal answer
```

---

## 6. MongoDB Schema Design

```javascript
// users collection
{
  _id, email, passwordHash, name,
  createdAt, lastLoginAt,
  stats: { totalSessions, avgScore, totalQuestions, totalAnswered }
}

// documents collection
{
  _id, userId, originalName, fileUrl,
  fileType, fileSize, status,          // "processing" | "ready" | "failed"
  chunkCount, chromaCollectionId,
  uploadedAt, processedAt
}

// sessions collection
{
  _id, userId, documentIds[],
  questions: [{
    questionId, text, type,
    idealAnswer, expectedKeywords, difficulty
  }],
  answers: [{
    questionId, transcribedText, audioUrl,
    contentScore, speechScore, compositeScore,
    feedback, answeredAt
  }],
  status,                              // "active" | "completed"
  totalScore, startedAt, completedAt
}

// performance collection (for analytics)
{
  _id, userId, sessionId,
  weakTopics[], strongTopics[],
  scoreHistory: [{ date, score }],
  spacedRepetitionQueue: [{ questionId, nextReviewDate, interval }]
}
```

---

## 7. Claude API Prompt Templates

### 7.1 Question Generation Prompt

```
System:
You are an expert quiz generator. Generate exactly {count} questions from the provided content.
Return ONLY valid JSON. No markdown, no explanation.

Schema: [{
  "question": string,
  "type": "factual" | "conceptual" | "inferential" | "application",
  "difficulty": "easy" | "medium" | "hard",
  "idealAnswer": string,
  "expectedKeywords": string[],
  "hints": string[]
}]

Rules:
- Questions must be directly answerable from the content
- Vary question types
- idealAnswer should be 2-4 sentences
- expectedKeywords: 3-6 key terms the answer should contain

User:
<content>
{document_chunks}
</content>

Difficulty: {difficulty}
Question count: {count}
```

### 7.2 Answer Evaluation Prompt

```
System:
You are an answer evaluator. Score the user's answer against the ideal answer.
Return ONLY valid JSON. No markdown, no explanation.

Schema: {
  "contentScore": number (0-100),
  "correctPoints": string[],
  "missedPoints": string[],
  "feedback": string,
  "improvedAnswer": string
}

User:
Question: {question}
Ideal Answer: {idealAnswer}
Expected Keywords: {keywords}
User's Answer: {transcribedText}

Evaluate for: accuracy, completeness, relevance.
```

---

## 8. API Endpoints Reference

### Node.js Gateway

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/documents/upload        # multipart/form-data
GET    /api/documents               # list user's documents
DELETE /api/documents/:id

POST   /api/sessions                # start new session
GET    /api/sessions/:id            # get session details
POST   /api/sessions/:id/answers    # submit voice answer
PATCH  /api/sessions/:id/complete   # end session

GET    /api/analytics/performance   # user stats + history
GET    /api/analytics/weak-topics   # spaced repetition queue
```

### FastAPI AI Service (internal)

```
POST   /process-document            # parse + embed document
POST   /generate-questions          # Claude question gen
POST   /evaluate-answer             # STT + eval pipeline
POST   /text-to-speech              # optional TTS for questions
```

---

## 9. Key Challenges & Solutions

| Challenge | Solution |
|---|---|
| Large document chunking | LangChain RecursiveCharacterTextSplitter; 512 token chunks, 50 token overlap |
| Voice accuracy (accents) | Use AssemblyAI (better accent handling) over Whisper for production |
| Evaluation latency | Stream Claude response via SSE; show partial feedback immediately |
| Cold start on AI service | Deploy FastAPI on always-on instance (Railway / Render); not serverless |
| ChromaDB persistence | Use ChromaDB with persistent storage path or hosted Chroma Cloud |
| Audio file size | Compress to mono 16kHz WAV before upload; target < 1MB per answer |
| Offline support | Cache last session locally; sync on reconnect |
| Multi-doc context window | Use top-K retrieval from ChromaDB; don't dump all chunks into prompt |

---

## 10. Folder Structure

```
project-root/
├── mobile/                        # React Native (Expo)
│   ├── app/                       # expo-router screens
│   │   ├── (auth)/
│   │   ├── (tabs)/
│   │   │   ├── home.tsx
│   │   │   ├── sessions.tsx
│   │   │   └── analytics.tsx
│   │   └── quiz/[sessionId].tsx
│   ├── components/
│   ├── hooks/
│   ├── store/                     # Zustand stores
│   └── services/                  # API client functions
│
├── backend/                       # Node.js / Express
│   ├── routes/
│   ├── controllers/
│   ├── models/                    # Mongoose schemas
│   ├── middleware/
│   └── services/                  # AI service client
│
├── ai-service/                    # Python / FastAPI
│   ├── routers/
│   ├── services/
│   │   ├── document_processor.py
│   │   ├── question_generator.py
│   │   ├── answer_evaluator.py
│   │   └── speech_processor.py
│   ├── vector_store/              # ChromaDB config
│   └── prompts/                   # Prompt templates
│
└── docker-compose.yml             # Local dev orchestration
```

---

## 11. Environment Variables

```bash
# Node.js Backend
MONGODB_URI=
JWT_SECRET=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AI_SERVICE_URL=http://localhost:8000

# Python AI Service
ANTHROPIC_API_KEY=
ASSEMBLYAI_API_KEY=
CHROMA_PERSIST_PATH=./chroma_db
AWS_S3_BUCKET=

# React Native
EXPO_PUBLIC_API_BASE_URL=
```

---

## 12. Development Phases

### Phase 1 — Foundation (Weeks 1–2)
- [ ] Expo project setup + navigation
- [ ] Node.js API with auth (JWT)
- [ ] MongoDB schemas + connection
- [ ] FastAPI skeleton + health check
- [ ] Document upload → S3 → parse → ChromaDB pipeline

### Phase 2 — Core AI Flow (Weeks 3–4)
- [ ] Question generation with Claude
- [ ] Voice recording in React Native
- [ ] Whisper/AssemblyAI STT integration
- [ ] Answer evaluation pipeline
- [ ] Basic feedback UI

### Phase 3 — Polish + Analytics (Weeks 5–6)
- [ ] Speech quality scoring
- [ ] Session history + performance dashboard
- [ ] Spaced repetition queue
- [ ] Error handling, loading states, offline fallbacks

### Phase 4 — Hardening (Week 7+)
- [ ] Rate limiting, input sanitization
- [ ] Logging + monitoring (Sentry)
- [ ] Performance profiling (cold start, latency)
- [ ] Beta testing on physical devices

---

*Last updated: 2025 | Stack versions: React Native 0.74+, Claude claude-sonnet-4-20250514, FastAPI 0.111+, LangChain 0.2+*
