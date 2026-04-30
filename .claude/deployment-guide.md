# Deployment Guide — AI Quiz App

> **Stack:** React Native (Expo) · Node.js / Express · MongoDB Atlas · LanceDB · Groq · Gemini
> **Last updated:** 2026-04-30

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Local Development](#2-local-development)
3. [GitHub Setup](#3-github-setup)
4. [MongoDB Atlas](#4-mongodb-atlas)
5. [Deploy Backend → Railway](#5-deploy-backend--railway)
6. [Deploy Mobile → Expo EAS](#6-deploy-mobile--expo-eas)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Production Config](#8-production-config)
9. [Pre-Deploy Checklist](#9-pre-deploy-checklist)
10. [Troubleshooting](#10-troubleshooting)
11. [Cost Estimate](#11-cost-estimate)
12. [Quick Reference](#12-quick-reference)

---

## 1. Project Structure

```
ai-quiz-app/
├── backend/                 ← Node.js / Express API (port 3000)
│   ├── src/
│   │   ├── app.js           ← Entry point
│   │   ├── middleware/      ← auth, upload, audioUpload
│   │   ├── models/          ← Mongoose schemas (User, Document, DailyQuestPlan, DailyQuestEntry)
│   │   ├── routes/          ← auth, documents, questions, sessions, voiceAnswer, feedback, analytics, dailyQuest
│   │   ├── services/        ← geminiService (Groq + Gemini), lanceDb, documentParser
│   │   └── prompts/         ← AI prompt templates
│   ├── server.js            ← HTTP server bootstrap
│   ├── Dockerfile.dev       ← Docker for local dev
│   ├── .env                 ← Local secrets (never commit)
│   └── package.json
├── frontend/                ← Expo React Native app
│   ├── app/                 ← Expo Router file-based routes
│   ├── components/          ← VoiceRecorder, QuestionFeedbackCard
│   ├── services/api.ts      ← All API calls + TypeScript types
│   ├── store/authStore.ts   ← Zustand auth state
│   ├── constants/           ← colors, typography, spacing
│   ├── .env                 ← EXPO_PUBLIC_API_BASE_URL
│   └── package.json
├── data/
│   └── lancedb/             ← LanceDB vector store (auto-created, gitignored)
├── docs/
│   └── STACK.md             ← Full technology documentation
├── docker-compose.yml       ← Local dev (backend only)
└── .gitignore
```

---

## 2. Local Development

### Step 2.1 — Prerequisites

Install these once:

- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Expo Go](https://expo.dev/go) on your physical phone

### Step 2.2 — Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ai-quiz-app.git
cd ai-quiz-app

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Step 2.3 — Backend Environment

Create `backend/.env` (never commit this file):

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://your-user:your-pass@cluster.mongodb.net/aiquizapp
JWT_SECRET=your-minimum-32-character-random-secret-here
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### Step 2.4 — Frontend Environment

Create `frontend/.env`:

```env
# Use your machine's LAN IP — not localhost — so the phone can reach it
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

Find your LAN IP:

- **Windows:** `ipconfig` → look for IPv4 Address under your Wi-Fi adapter
- **Mac/Linux:** `ifconfig | grep inet`

> Phone and laptop must be on the **same Wi-Fi network**.

### Step 2.5 — Run Locally

**Option A — Docker (recommended):**

```bash
# From project root — starts backend with hot reload
docker-compose up

# Rebuild if you change package.json
docker-compose up --build

# Stop
docker-compose down
```

**Option B — Terminal (faster startup):**

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# Expected: Server running on port 3000

# Terminal 2 — Frontend
cd frontend
npx expo start
# Scan QR code with Expo Go on your phone
```

### Step 2.6 — Verify Local Setup

```bash
# Health check
curl http://localhost:3000/api/health
# Expected: { "status": "ok" }

# Register a test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"Test1234!"}'
# Expected: { "token": "eyJ...", "user": { ... } }
```

---

## 3. GitHub Setup

### Step 3.1 — Initialize and Push

```bash
# From project root
git init
git add .
git commit -m "feat: initial commit"

# Create repo at github.com (Private recommended)
git remote add origin https://github.com/YOUR_USERNAME/ai-quiz-app.git
git branch -M main
git push -u origin main
```

### Step 3.2 — Branch Strategy

```
main          ← production only — Railway auto-deploys from this
dev           ← active development
feature/xyz   ← individual features
```

```bash
# Daily workflow
git checkout dev
# make changes...
git add . && git commit -m "feat: your message"
git push

# Ship to production
git checkout main
git merge dev
git push   # triggers Railway auto-deploy
```

### Step 3.3 — .gitignore (root)

Ensure these are ignored:

```gitignore
# Environment
.env
.env.local
.env.*

# Node
node_modules/
dist/

# Expo
.expo/
*.jks *.p8 *.p12 *.key *.mobileprovision

# LanceDB data
data/

# Logs
*.log

# OS
.DS_Store
Thumbs.db
```

---

## 4. MongoDB Atlas

### Step 4.1 — Create Cluster (Browser, One Time)

```
1. Go to: https://cloud.mongodb.com
2. Sign up / Log in
3. Build a Database → M0 FREE → AWS → ap-south-1
4. Username: quiz-admin
5. Password: generate a strong one — save it immediately
6. IP Access: Add 0.0.0.0/0 (allow all — required for Railway)
7. Connect → Drivers → Copy connection string
```

Connection string format:

```
mongodb+srv://quiz-admin:<password>@cluster0.xxxxx.mongodb.net/aiquizapp?retryWrites=true&w=majority
```

### Step 4.2 — Collections Created Automatically

Mongoose creates these on first use — no manual setup needed:

| Collection          | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `users`             | Accounts, password hashes, stats              |
| `documents`         | Uploaded file metadata (not the text content) |
| `dailyquestplans`   | One plan per user per UTC day                 |
| `dailyquestentries` | Individual answer submissions                 |

---

## 5. Deploy Backend → Railway

### Step 5.1 — Create Railway Project (Browser, One Time)

```
1. Go to: https://railway.app
2. Sign up with GitHub
3. New Project → Deploy from GitHub Repo
4. Select: ai-quiz-app
5. Root Directory: backend         ← important
6. Railway auto-detects Node.js
7. Click Deploy
```

### Step 5.2 — Add Environment Variables (Browser)

```
Railway Dashboard → your project → backend service → Variables → Add All:
```

| Variable         | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| `PORT`           | `3000`                                                       |
| `NODE_ENV`       | `production`                                                 |
| `MONGODB_URI`    | `mongodb+srv://quiz-admin:...@cluster.mongodb.net/aiquizapp` |
| `JWT_SECRET`     | `your-minimum-32-char-random-string`                         |
| `GROQ_API_KEY`   | `gsk_...`                                                    |
| `GEMINI_API_KEY` | `AIza...`                                                    |

### Step 5.3 — Production Dockerfile

Create `backend/Dockerfile` (Railway uses this for production, not `Dockerfile.dev`):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Step 5.4 — Get Your Public URL

```
Railway Dashboard → backend → Settings → Networking → Generate Domain
```

Your backend URL will be:

```
https://ai-quiz-app-production.up.railway.app
```

### Step 5.5 — Enable Auto-Deploy

```
Railway Dashboard → backend → Settings → Deploy → Auto Deploy → main branch
```

Now every `git push origin main` auto-deploys the backend.

### Step 5.6 — Install Railway CLI (Terminal Deploys)

```bash
npm install -g @railway/cli
railway login          # opens browser OAuth

# From project root
railway link           # select your project

# Deploy from terminal
cd backend
railway up

# View live logs
railway logs --tail

# Check deployment status
railway status
```

### Step 5.7 — Verify Live Backend

```bash
# Replace with your actual Railway URL
curl https://your-app.up.railway.app/api/health
# Expected: { "status": "ok" }

curl -X POST https://your-app.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"Test1234!"}'
# Expected: { "token": "eyJ...", "user": { ... } }
```

---

## 6. Deploy Mobile → Expo EAS

### Step 6.1 — Point Frontend at Live Backend

Update `frontend/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-app.up.railway.app
```

Commit and push this change.

### Step 6.2 — EAS Setup (One Time)

```bash
npm install -g eas-cli
eas login

cd frontend
eas build:configure
# Creates eas.json — commit this file
```

### Step 6.3 — Create `frontend/eas.json`

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 6.4 — Build Android APK (Share Directly — No Store Needed)

```bash
cd frontend
eas build --platform android --profile preview

# EAS builds in the cloud (~10-15 min)
# You get a download link → share the .apk directly with anyone
# Install on Android: enable "Install from unknown sources" in phone settings
```

### Step 6.5 — Build for Production Stores

```bash
# Build both platforms
y

# Submit to Google Play Store
eas submit --platform android

# Submit to Apple App Store (requires $99/yr Apple Developer account)
eas submit --platform ios
```

### Step 6.6 — Update App After Backend Changes

The mobile app talks to the backend URL baked into the `.env` at build time. If your Railway URL changes:

1. Update `frontend/.env` with the new URL
2. Run `eas build` again to produce a new APK

---

## 7. Environment Variables Reference

### Backend (`backend/.env`)

| Variable         | Required | Example                 | Description                                                    |
| ---------------- | -------- | ----------------------- | -------------------------------------------------------------- |
| `PORT`           | No       | `3000`                  | Defaults to 3000                                               |
| `NODE_ENV`       | Yes      | `production`            | Enables production error handling                              |
| `MONGODB_URI`    | Yes      | `mongodb+srv://...`     | MongoDB Atlas connection string                                |
| `JWT_SECRET`     | Yes      | `random-32-char-string` | Signs all auth tokens — change this to invalidate all sessions |
| `GROQ_API_KEY`   | Yes      | `gsk_...`               | From console.groq.com — free tier: 14,400 req/day              |
| `GEMINI_API_KEY` | Yes      | `AIza...`               | From aistudio.google.com — used for embeddings + vision OCR    |

### Frontend (`frontend/.env`)

| Variable                   | Required | Example                           | Description                            |
| -------------------------- | -------- | --------------------------------- | -------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL` | Yes      | `https://your-app.up.railway.app` | Baked into the JS bundle at build time |

> `EXPO_PUBLIC_*` variables are **visible to users** — never put secrets here.

### Backend `.env.example` (commit this file, not `.env`)

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/aiquizapp
JWT_SECRET=replace-with-32-char-minimum-random-string
GROQ_API_KEY=gsk_replace_with_real_key
GEMINI_API_KEY=AIza_replace_with_real_key
```

---

## 8. Production Config

### Security Headers

Add to `backend/src/app.js` before routes:

```js
const helmet = require("helmet"); // npm install helmet
app.use(helmet());
app.set("trust proxy", 1); // required behind Railway's proxy
```

### Rate Limiting

```js
const rateLimit = require("express-rate-limit"); // npm install express-rate-limit

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 login attempts per window
    message: { error: "Too many requests, please try again later." },
  }),
);

app.use(
  "/api/questions/generate",
  rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 generation calls per minute
  }),
);
```

### Logging

```js
const morgan = require("morgan"); // npm install morgan
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
```

### LanceDB on Railway

LanceDB writes to `./data/lancedb/` on disk. Railway's filesystem is **ephemeral** — data is lost on each deploy.

**Fix — Add a Railway Volume:**

```
Railway Dashboard → backend service → Volumes
→ Add Volume
→ Mount Path: /app/data
→ Size: 1 GB (free)
```

This persists the LanceDB data across deploys.

### CORS for Production

In `backend/src/app.js`, restrict CORS to known origins:

```js
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://your-app.up.railway.app",
            /^exp:\/\//, // Expo Go
          ]
        : "*",
    credentials: true,
  }),
);
```

---

## 9. Pre-Deploy Checklist

### Every Deploy

```
Code
 [ ] No hardcoded IP addresses or localhost URLs
 [ ] No console.log with sensitive data
 [ ] No API keys in source code
 [ ] .env in .gitignore, .env.example committed instead

Backend
 [ ] GET /api/health returns 200
 [ ] POST /api/auth/register works end-to-end
 [ ] POST /api/auth/login works end-to-end
 [ ] POST /api/documents/upload works with a PDF
 [ ] POST /api/questions/generate returns questions
 [ ] POST /api/sessions/:id/voice-answer transcribes correctly

Database
 [ ] MongoDB Atlas connection string is valid
 [ ] Atlas IP whitelist includes 0.0.0.0/0 (or Railway IPs)

AI APIs
 [ ] GROQ_API_KEY is valid — test at console.groq.com
 [ ] GEMINI_API_KEY is valid — test at aistudio.google.com
 [ ] Both APIs have sufficient quota

Mobile
 [ ] EXPO_PUBLIC_API_BASE_URL points to deployed Railway URL (not localhost)
 [ ] EAS build completes without error
 [ ] App connects to backend on a real device
 [ ] Voice recording + submission works on device
```

---

## 10. Troubleshooting

### Backend

| Error                                  | Cause                                    | Fix                                                                      |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `MongooseServerSelectionError`         | Wrong URI or IP not whitelisted          | Check `MONGODB_URI`, add `0.0.0.0/0` in Atlas Network Access             |
| `JsonWebTokenError: invalid signature` | `JWT_SECRET` changed or missing          | Set consistent `JWT_SECRET` in Railway variables                         |
| `503 POST /api/documents/upload`       | Gemini API unavailable or quota exceeded | Check Gemini quota at aistudio.google.com; Groq is the fallback for text |
| `429 Too Many Requests` from Groq      | Hit daily or per-minute limit            | Free tier: 14,400/day. Add 60s delay or upgrade plan                     |
| Port already in use                    | Another process on 3000                  | `npx kill-port 3000` or change `PORT` in `.env`                          |
| LanceDB data lost on redeploy          | Railway ephemeral filesystem             | Add a Railway Volume mounted at `/app/data`                              |

### Frontend / Mobile

| Error                                 | Cause                                       | Fix                                                                      |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `Network request failed`              | Wrong `EXPO_PUBLIC_API_BASE_URL`            | Check the URL — must be LAN IP for local, Railway URL for production     |
| `Network request failed` (local)      | Phone not on same Wi-Fi                     | Connect phone and laptop to same network                                 |
| Filename shows `%20` or `%`           | URL-encoded filename from Android picker    | Fixed in backend (`decodeURIComponent(originalname)`) — redeploy backend |
| Tab labels not visible                | Tab bar height too small                    | Fixed in `_layout.tsx` (height: 60 + insets.bottom)                      |
| `Microphone permission denied`        | Mic permission not granted                  | Go to phone Settings → Apps → AI Quiz → Permissions → Microphone         |
| Voice answer returns empty transcript | Audio format unsupported or too short       | Speak for at least 3 seconds; ensure mic is not muted                    |
| `expo-av` error on Android            | Missing RECORD_AUDIO permission in app.json | Already added — rebuild the APK with `eas build`                         |

### EAS Build

| Error                             | Cause                         | Fix                                                                 |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `eas: command not found`          | EAS CLI not installed         | `npm install -g eas-cli`                                            |
| Build fails: missing env          | `EXPO_PUBLIC_*` not set       | Add to `frontend/.env` and rebuild                                  |
| APK not installing on Android     | "Unknown sources" disabled    | Phone Settings → Security → Install Unknown Apps → enable for Files |
| iOS build fails: no Apple account | No Apple Developer membership | Use Android APK for testing; iOS requires $99/yr membership         |

### API Keys

| Symptom                    | Check                                                          |
| -------------------------- | -------------------------------------------------------------- |
| All AI features fail       | Both `GROQ_API_KEY` and `GEMINI_API_KEY` set in Railway?       |
| Questions not generating   | Groq key valid at [console.groq.com](https://console.groq.com) |
| Voice transcription fails  | Groq Whisper uses same key — check quota                       |
| Session vectors not saving | Gemini embedding fails — check `GEMINI_API_KEY`                |
| PDF upload returns 422     | Image-based (scanned) PDF — use a text-based PDF instead       |

---

## 11. Cost Estimate

| Service                     | Free Tier                | Notes                                              |
| --------------------------- | ------------------------ | -------------------------------------------------- |
| **Railway**                 | $5 credit/month          | Backend + 1 GB volume; ~$5-10/mo after free credit |
| **MongoDB Atlas**           | M0 — 512 MB free         | Sufficient for hundreds of users                   |
| **Groq API**                | 14,400 requests/day free | Covers ~1,400 sessions/day at 10 calls each        |
| **Gemini API**              | 1,500 requests/day free  | Used for embeddings (1 per session) + OCR fallback |
| **Expo EAS**                | 30 builds/month free     | Enough for active development                      |
| **Google Play Store**       | $25 one-time             | For Android distribution                           |
| **Apple App Store**         | $99/year                 | For iOS distribution                               |
| **Total (dev/small scale)** | **~$0–10/month**         | Until Railway free credit runs out                 |

---

## 12. Quick Reference

### Local Dev

```bash
# Start everything with Docker
docker-compose up --build

# Start without Docker
cd backend && npm run dev          # Terminal 1
cd frontend && npx expo start      # Terminal 2

# Health check
curl http://localhost:3000/api/health
```

### Deploy Backend

```bash
# Push to main → Railway auto-deploys
git add . && git commit -m "your message" && git push origin main

# Manual deploy via CLI
cd backend && railway up

# View live logs
railway logs --tail

# Check status
railway status
```

### Build Mobile App

```bash
cd frontend

# Android APK for testing (no store needed)
eas build --platform android --profile preview

# Production builds for both stores
eas build --platform all --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

### Verify Live App

```bash
# Replace with your Railway URL
BASE=https://your-app.up.railway.app

curl $BASE/api/health
curl -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}'
```
