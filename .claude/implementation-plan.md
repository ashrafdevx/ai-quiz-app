# 🚀 Implementation Startup Plan — AI Document Quiz App

> **Strategy:** Build → Test → Confirm → Move on.  
> One module at a time. Never implement the whole system in one session.  
> Each sprint ends with a working, testable deliverable.

---

## How to Use This File with Claude

```
When starting a new Claude session, paste:
1. ai-doc-quiz-app-prompt.md  (architecture reference)
2. This file                  (current sprint context)
3. Say: "We are on Sprint X, Task Y. Let's implement it."
```

**Rule:** Never ask Claude to build more than one task per session.  
**Rule:** Always test the output before moving to the next task.

---

## Pre-Sprint Checklist — Do This First (1–2 hours)

Before writing a single line of code, set up your environment.

```bash
# 1. Install tools
node --version        # Need 18+
python --version      # Need 3.11+
mongod --version      # Or use MongoDB Atlas (recommended)
docker --version      # Optional but helpful

# 2. Create project root
mkdir ai-quiz-app && cd ai-quiz-app
git init

# 3. Create three folders
mkdir mobile backend ai-service

# 4. Create .env files (empty for now, fill per sprint)
touch backend/.env
touch ai-service/.env
```

**Accounts to create now (free tiers work):**
- [ ] [MongoDB Atlas](https://cloud.mongodb.com) — get connection string
- [ ] [Anthropic Console](https://console.anthropic.com) — get API key
- [ ] [AssemblyAI](https://assemblyai.com) — get API key (STT)
- [ ] [AWS S3](https://aws.amazon.com) or [Cloudinary](https://cloudinary.com) — file storage
- [ ] [Expo Account](https://expo.dev) — for mobile builds

---

## Sprint 0 — Project Skeleton (Day 1)

**Goal:** Three apps running simultaneously with health check endpoints.  
**Time estimate:** 3–4 hours  
**Claude session prompt:** *"Set up three project skeletons: Expo React Native app, Node.js Express API, and Python FastAPI service. Each should have a working health check. No features yet."*

### Tasks

- [ ] **S0-T1** — Expo React Native project init
  ```bash
  cd mobile
  npx create-expo-app . --template blank-typescript
  npx expo start
  ```
  **Test:** App loads on Expo Go on your phone ✓

- [ ] **S0-T2** — Node.js Express skeleton
  ```bash
  cd backend
  npm init -y
  npm install express mongoose dotenv cors helmet
  # Create: server.js, routes/health.js
  ```
  **Test:** `GET /health` returns `{ status: "ok" }` ✓

- [ ] **S0-T3** — Python FastAPI skeleton
  ```bash
  cd ai-service
  python -m venv venv && source venv/bin/activate
  pip install fastapi uvicorn python-dotenv
  # Create: main.py with GET /health
  uvicorn main:app --reload --port 8000
  ```
  **Test:** `GET /health` returns `{ status: "ok" }` ✓

- [ ] **S0-T4** — MongoDB Atlas connection test
  **Test:** Node.js connects to Atlas, logs "MongoDB connected" ✓

---

## Sprint 1 — Authentication System (Days 2–3)

**Goal:** Users can register, login, get JWT token.  
**Time estimate:** 4–6 hours  
**One session per task below.**

### Tasks

- [ ] **S1-T1** — User model + register endpoint
  - Mongoose `User` schema (email, passwordHash, name, stats)
  - `POST /api/auth/register` with bcrypt password hashing
  - Zod validation
  - **Test:** Register user via Postman, check Atlas has the document ✓

- [ ] **S1-T2** — Login endpoint + JWT
  - `POST /api/auth/login` → returns `{ token, user }`
  - JWT middleware for protected routes
  - **Test:** Login with wrong password returns 401; correct returns token ✓

- [ ] **S1-T3** — Auth screens in React Native
  - Register screen (name, email, password)
  - Login screen
  - Store JWT in `expo-secure-store`
  - **Test:** Login on phone, token stored, navigates to home screen ✓

- [ ] **S1-T4** — Protected route guard
  - Check token on app load → redirect to login if expired
  - **Test:** Kill app, reopen — stays logged in ✓

---

## Sprint 2 — Document Upload Pipeline (Days 4–6)

**Goal:** User uploads a PDF → it gets parsed → text stored.  
**Time estimate:** 6–8 hours  
**This is your first real AI feature. Take it slow.**

### Tasks

- [ ] **S2-T1** — File upload in React Native
  - `expo-document-picker` for PDF/DOCX selection
  - `expo-file-system` to read file as base64
  - Upload to `POST /api/documents/upload` as multipart
  - **Test:** Select PDF on phone, see upload request in Node.js logs ✓

- [ ] **S2-T2** — Node.js file handling + S3 storage
  - `multer` middleware to receive file
  - Upload buffer to AWS S3 or Cloudinary
  - Save metadata to MongoDB `documents` collection
  - Return `{ documentId, fileUrl, status: "processing" }`
  - **Test:** Postman upload → file appears in S3 bucket, record in Atlas ✓

- [ ] **S2-T3** — Python document parser
  - FastAPI `POST /process-document` endpoint
  - `pdfplumber` for PDF text extraction
  - `python-docx` for DOCX text extraction
  - Download file from S3, parse, return `{ text, pageCount }`
  - **Test:** Send S3 URL to FastAPI → get back clean extracted text ✓

- [ ] **S2-T4** — ChromaDB embedding + storage
  - Install `chromadb`, `sentence-transformers`
  - Chunk text with LangChain `RecursiveCharacterTextSplitter`
    - chunk_size: 512, overlap: 50
  - Embed chunks, store in ChromaDB collection named by `documentId`
  - **Test:** After processing, query ChromaDB with a topic → returns relevant chunk ✓

- [ ] **S2-T5** — Wire up Node.js → FastAPI trigger
  - After S3 upload succeeds, Node.js calls `POST /process-document`
  - Update MongoDB document status: `"processing"` → `"ready"`
  - **Test:** Upload PDF in app → status changes to "Ready" in 10–30s ✓

---

## Sprint 3 — Question Generation (Days 7–9)

**Goal:** From a processed document, generate quiz questions using Claude.  
**Time estimate:** 4–5 hours

### Tasks

- [ ] **S3-T1** — Claude question generation endpoint
  - FastAPI `POST /generate-questions`
  - Retrieve top-10 chunks from ChromaDB for the document
  - Call Claude API with the question generation prompt (from master prompt file, section 7.1)
  - Parse JSON response → return questions array
  - **Test:** Send documentId → get back 5 well-structured questions ✓

- [ ] **S3-T2** — Session creation in Node.js
  - `POST /api/sessions` → calls FastAPI → saves session + questions to MongoDB
  - **Test:** Postman call → session appears in Atlas with questions array ✓

- [ ] **S3-T3** — Question display UI in React Native
  - Session screen showing one question at a time
  - Question card with type badge (Factual / Conceptual / Inferential)
  - Difficulty indicator
  - Next/Previous navigation
  - **Test:** Start a session on phone — see questions rendered correctly ✓

---

## Sprint 4 — Voice Recording + STT (Days 10–12)

**Goal:** User speaks an answer, get back a transcript.  
**Time estimate:** 5–6 hours  
**This sprint has the most device-specific friction. Budget extra time.**

### Tasks

- [ ] **S4-T1** — Voice recorder component in React Native
  - `expo-av` or `react-native-audio-recorder-player`
  - Record button (hold to record OR tap toggle)
  - Visual waveform animation while recording (CSS pulse effect)
  - Export as `.m4a` or `.wav`
  - **Test:** Record 10 seconds → file saved locally → can play it back ✓

- [ ] **S4-T2** — Audio upload to backend
  - Compress audio: mono, 16kHz (reduces size ~60%)
  - Upload audio blob to `POST /api/answers`
  - Node.js stores audio to S3, forwards to FastAPI
  - **Test:** Recorded audio appears in S3 bucket ✓

- [ ] **S4-T3** — AssemblyAI STT integration
  - FastAPI: submit audio URL to AssemblyAI
  - Poll for transcript (or use webhook)
  - Return `{ transcript, confidence, words[] }`
  - **Test:** Upload a clear spoken answer → transcript returned within 5–10s ✓

- [ ] **S4-T4** — Display transcript in app
  - Show transcribed text below the voice recorder
  - Allow user to edit transcript if needed (optional)
  - **Test:** Speak an answer on phone → see your words appear on screen ✓

---

## Sprint 5 — Answer Evaluation (Days 13–15)

**Goal:** Score the answer for content accuracy AND speech quality.  
**Time estimate:** 5–6 hours  
**The core differentiating feature of the app.**

### Tasks

- [ ] **S5-T1** — Speech quality analyzer
  - Count filler words (um, uh, like, you know, basically)
  - Calculate WPM (words per minute — ideal: 120–160)
  - Use AssemblyAI confidence scores as proxy for clarity
  - Return `{ fillerWordCount, wpm, clarityScore }`
  - **Test:** Record a rambling answer → filler words are flagged ✓

- [ ] **S5-T2** — Claude answer evaluation
  - FastAPI: call Claude with evaluation prompt (section 7.2 from master prompt)
  - Compare transcript vs idealAnswer semantically
  - Claude returns `{ contentScore, correctPoints[], missedPoints[], feedback, improvedAnswer }`
  - **Test:** Give a partially correct answer → score is 40–70, feedback mentions what's missing ✓

- [ ] **S5-T3** — Composite scoring formula
  ```python
  composite_score = (content_score * 0.70) + (speech_score * 0.30)
  # speech_score = weighted average of clarity, filler penalty, WPM score
  ```
  - **Test:** Perfect answer, poor speech → composite ~75. Perfect answer, perfect speech → ~95 ✓

- [ ] **S5-T4** — Feedback UI in React Native
  - Score card with animated circular progress
  - Two sections: Content Score + Speech Score
  - Correct points shown in green
  - Missed points shown in amber
  - Ideal answer shown in expandable card
  - **Test:** Complete a full question cycle → see rich feedback screen ✓

---

## Sprint 6 — Session Completion + History (Days 16–18)

**Goal:** Users can complete a session and see their history.  
**Time estimate:** 4–5 hours

### Tasks

- [ ] **S6-T1** — Session completion logic
  - Calculate overall session score (average of all composite scores)
  - Update session status: `"completed"`
  - Update user stats in MongoDB
  - **Test:** Complete 5 questions → session marked done, avg score saved ✓

- [ ] **S6-T2** — Performance analytics endpoint
  - `GET /api/analytics/performance` → returns score history, weak topics
  - Identify weak topics from `missedPoints` across sessions
  - **Test:** After 3 sessions, API returns trend data ✓

- [ ] **S6-T3** — History + Dashboard UI
  - Home screen dashboard: total sessions, average score, streak
  - Session history list with date, document name, score
  - Tap session → see all Q&A from that session
  - **Test:** History screen shows past sessions with scores ✓

---

## Sprint 7 — Polish + Edge Cases (Days 19–21)

**Goal:** Make it production-worthy, not just functional.

### Tasks

- [ ] **S7-T1** — Loading states + error handling everywhere
  - Skeleton loaders on all data-fetching screens
  - Retry buttons on failed API calls
  - Toast notifications for errors
  
- [ ] **S7-T2** — Offline detection
  - Detect no internet connection
  - Show banner: "You're offline — some features unavailable"
  
- [ ] **S7-T3** — Rate limiting + input validation
  - Node.js: `express-rate-limit` on all endpoints
  - Sanitize file uploads (type checking, size limits)
  
- [ ] **S7-T4** — End-to-end test run
  - Full flow: Register → Upload PDF → Start Quiz → Answer 3 questions → View results
  - Test on both iOS (Expo Go) and Android
  
- [ ] **S7-T5** — Performance check
  - Document processing time (target: < 30s for 10-page PDF)
  - STT turnaround time (target: < 8s)
  - Answer evaluation time (target: < 5s with streaming)

---

## How to Talk to Claude Per Sprint

### Starting a task
```
I'm working on AI Document Quiz App.
Current sprint: Sprint 2, Task S2-T3 (Python document parser).
Stack: FastAPI, pdfplumber, python-docx, AWS S3.
Implement only this task. No other features.
```

### When you get stuck
```
I'm on S2-T3. The pdfplumber extraction works but 
the text has too many newlines and artifacts. 
Here's the raw output: [paste output]
Clean it up and return well-structured paragraphs.
```

### When asking for the next task
```
S2-T3 is done and tested. 
Moving to S2-T4 (ChromaDB embedding).
Here's the clean text output from the parser: [paste output]
Implement the chunking and embedding pipeline only.
```

---

## Token-Saving Tips

| Instead of... | Do this... |
|---|---|
| "Build the entire backend" | "Build only the User model and register endpoint" |
| Pasting entire files | Paste only the relevant function/route |
| "Does this look good?" | Run the test yourself first, ask only if it fails |
| Starting fresh each time | Keep a "current state" note at top of session |
| Asking Claude to test | Always test yourself before next session |

---

## Milestone Summary

| Milestone | Sprint | What You Can Demo |
|---|---|---|
| 🟡 Skeleton | 0 | Three servers running |
| 🟡 Auth | 1 | Login / Register on phone |
| 🟠 Upload | 2 | PDF processed + embedded |
| 🟠 Questions | 3 | AI generates quiz questions |
| 🔴 Voice | 4 | Record voice, see transcript |
| 🔴 Evaluation | 5 | Score + feedback after answering |
| 🟢 **MVP** | 6 | Full session flow + history |
| ✅ **Shippable** | 7 | Polished, error-handled, tested |

---

*Estimated total time: 3–4 weeks at 3–4 hours/day*  
*Each sprint = one focused Claude conversation (sometimes 2–3 for larger tasks)*
