# 🚀 Deployment Guide — AI Document Quiz App

> **Stack:** Next.js (Vercel) · Node.js API (Railway) · Python FastAPI (Railway) · MongoDB Atlas · Expo (React Native)
> **Answer:** Use **both** — browser for first-time setup & config, terminal for every deploy after that.

---

## Browser vs Terminal — The Rule

| Task | Where |
|---|---|
| Create accounts, projects, teams | Browser |
| Set environment variables | Browser (safer — never in terminal history) |
| Connect GitHub repo to a service | Browser |
| Configure domains, SSL, billing | Browser |
| Every actual deployment after setup | Terminal |
| Checking logs when something breaks | Both |

**One-liner:** Set up once in the browser. Deploy forever from the terminal.

---

## Part 1 — Local Development (Before Any Deployment)

### Step 1.1 — Folder Structure

```
ai-quiz-app/
├── mobile/          ← Expo React Native
├── backend/         ← Node.js / Express
├── ai-service/      ← Python FastAPI
├── landing/         ← Next.js landing page (DocQuizLanding.jsx)
├── docker-compose.yml
├── .gitignore
└── README.md
```

### Step 1.2 — Root `.gitignore`

```gitignore
# Node
node_modules/
.next/
dist/
build/

# Python
__pycache__/
*.pyc
venv/
.venv/
*.egg-info/

# Env files — NEVER commit these
.env
.env.local
.env.production
.env.*.local

# Expo
.expo/
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# ChromaDB local data
chroma_data/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
```

### Step 1.3 — `docker-compose.yml` (Local Dev Only)

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "4000:4000"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - chroma

  ai-service:
    build:
      context: ./ai-service
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    env_file:
      - ./ai-service/.env
    volumes:
      - ./ai-service:/app
      - ./chroma_data:/chroma_data

  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - ./chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE

# Run everything: docker-compose up
# Stop everything: docker-compose down
# Rebuild after dependency changes: docker-compose up --build
```

### Step 1.4 — Backend `Dockerfile.dev`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
```

### Step 1.5 — AI Service `Dockerfile.dev`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 1.6 — Run Everything Locally

```bash
# Terminal — from project root
docker-compose up

# Expected output:
# backend    | Server running on port 4000
# ai-service | Uvicorn running on http://0.0.0.0:8000
# chroma     | Running on http://0.0.0.0:8000

# Test all three health checks:
curl http://localhost:4000/health   # { "status": "ok" }
curl http://localhost:8000/health   # { "status": "ok" }
curl http://localhost:8001/api/v1/heartbeat  # { "nanosecond heartbeat": ... }
```

---

## Part 2 — GitHub Setup (Required for All Platforms)

### Step 2.1 — Init Git and Push

```bash
# Terminal — from project root
git init
git add .
git commit -m "feat: initial project setup"

# Browser: go to github.com → New Repository
# Name: ai-quiz-app
# Visibility: Private (recommended while in dev)
# Do NOT initialize with README (you already have files)

# Terminal — back in your project
git remote add origin https://github.com/YOUR_USERNAME/ai-quiz-app.git
git branch -M main
git push -u origin main
```

### Step 2.2 — Branch Strategy (Simple)

```
main         ← production-ready code only
dev          ← your active development branch
feature/xyz  ← individual feature branches
```

```bash
# Create dev branch
git checkout -b dev
git push -u origin dev

# Daily workflow:
git checkout dev
# ... make changes ...
git add .
git commit -m "feat: sprint-2 document upload pipeline"
git push

# Deploy to production:
git checkout main
git merge dev
git push   # triggers auto-deploy on Vercel + Railway
```

---

## Part 3 — MongoDB Atlas Setup

### Step 3.1 — Browser Setup (One Time)

```
1. Go to: https://cloud.mongodb.com
2. Sign up / Log in
3. Click "Build a Database"
4. Choose: M0 FREE (for dev) → AWS → ap-south-1 (Pakistan region, lowest latency)
5. Username: quiz-admin
6. Password: generate a strong one, SAVE IT NOW
7. Click "Add My Current IP Address"
8. Click "Finish and Close"
9. Click "Connect" → "Drivers" → Copy the connection string
```

Connection string format:
```
mongodb+srv://quiz-admin:<password>@cluster0.xxxxx.mongodb.net/docquiz?retryWrites=true&w=majority
```

### Step 3.2 — Allow All IPs (for Railway/Vercel)

```
Browser: Atlas Dashboard
→ Network Access
→ Add IP Address
→ Allow Access from Anywhere (0.0.0.0/0)
→ Confirm

Note: Fine for dev. For production, whitelist Railway/Vercel IPs specifically.
```

---

## Part 4 — Vercel (Next.js Landing Page)

### Step 4.1 — Browser Setup (One Time)

```
1. Go to: https://vercel.com
2. Sign up with GitHub account
3. Click "Add New Project"
4. Import your "ai-quiz-app" repo
5. Set Root Directory: landing    ← important!
6. Framework Preset: Next.js      ← auto-detected
7. Build Command: next build       ← default
8. Output Directory: .next         ← default
9. Click "Deploy"
```

### Step 4.2 — Environment Variables in Browser

```
Vercel Dashboard → Your Project → Settings → Environment Variables

Add:
NEXT_PUBLIC_API_URL = https://your-api.railway.app
NEXT_PUBLIC_APP_NAME = DocQuiz AI

Set for: Production + Preview + Development
```

### Step 4.3 — Terminal Deploy (Every Time After Setup)

```bash
# Install Vercel CLI once
npm install -g vercel

# Login once
vercel login

# Deploy from landing/ folder
cd landing
vercel --prod

# Or just push to main branch — auto-deploys
git push origin main
```

### Step 4.4 — Custom Domain (Optional, Browser)

```
Vercel Dashboard → Project → Settings → Domains
→ Add: docquizai.com
→ Follow DNS instructions (add CNAME record in your domain registrar)
→ Vercel handles SSL automatically
```

### Step 4.5 — Verify Deployment

```bash
# Terminal
curl https://your-app.vercel.app
# Should return your landing page HTML with 200 status
```

---

## Part 5 — Railway (Node.js API + Python FastAPI)

### Step 5.1 — Browser Setup (One Time)

```
1. Go to: https://railway.app
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Select "ai-quiz-app"
6. Railway will show all folders — select "backend" first
7. Railway auto-detects Node.js from package.json
8. Click "Deploy"
```

### Step 5.2 — Add Second Service (FastAPI) in Browser

```
Railway Dashboard → Your Project
→ + New Service
→ GitHub Repo → ai-quiz-app
→ Root Directory: ai-service
→ Railway detects Python from requirements.txt
→ Deploy
```

### Step 5.3 — Railway Dockerfiles for Production

**`backend/Dockerfile`** (production):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

**`ai-service/Dockerfile`** (production):
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### Step 5.4 — Environment Variables in Browser

```
Railway Dashboard → backend service → Variables

MONGODB_URI         = mongodb+srv://quiz-admin:...
JWT_SECRET          = your-super-secret-key-min-32-chars
AWS_S3_BUCKET       = docquiz-uploads
AWS_ACCESS_KEY_ID   = AKIA...
AWS_SECRET_ACCESS_KEY = ...
AI_SERVICE_URL      = http://ai-service.railway.internal:8000
NODE_ENV            = production
PORT                = 4000
```

```
Railway Dashboard → ai-service → Variables

ANTHROPIC_API_KEY   = sk-ant-...
ASSEMBLYAI_API_KEY  = ...
CHROMA_PERSIST_PATH = /data/chroma
AWS_S3_BUCKET       = docquiz-uploads
AWS_ACCESS_KEY_ID   = AKIA...
AWS_SECRET_ACCESS_KEY = ...
ENVIRONMENT         = production
```

> **Key:** `AI_SERVICE_URL = http://ai-service.railway.internal:8000`
> This is Railway's private internal network — the AI service is NOT exposed to the public internet. Only your backend can call it. This is the correct architecture.

### Step 5.5 — Add Persistent Volume for ChromaDB (Browser)

```
Railway Dashboard → ai-service → Volumes
→ Add Volume
→ Mount Path: /data/chroma
→ Size: 5 GB (free tier gives 1GB, upgrade as needed)
```

### Step 5.6 — Install Railway CLI and Deploy from Terminal

```bash
# Install once
npm install -g @railway/cli

# Login once
railway login
# Opens browser for OAuth — click Authorize

# Link your project (run from repo root)
railway link
# Select your project from the list

# Deploy backend from terminal
cd backend
railway up

# Deploy AI service from terminal
cd ../ai-service
railway up

# View live logs
railway logs

# Open service in browser
railway open
```

### Step 5.7 — Auto-Deploy on Push (Recommended)

```
Railway Dashboard → backend → Settings → Deploy
→ Enable "Auto Deploy"
→ Branch: main

# Now every git push to main auto-deploys
git push origin main
# Railway: building... deployed ✓
# Vercel:  building... deployed ✓
# Both happen simultaneously
```

### Step 5.8 — Verify Railway Deployment

```bash
# Terminal — test your live API
curl https://your-api.railway.app/health
# { "status": "ok", "env": "production" }

curl -X POST https://your-api.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"Test1234"}'
# { "token": "eyJ...", "user": {...} }
```

---

## Part 6 — AWS S3 (File Storage)

### Step 6.1 — Browser Setup (One Time)

```
1. Go to: https://aws.amazon.com → Sign in to Console
2. Search "S3" → Create Bucket
3. Bucket name: docquiz-uploads-dev
4. Region: ap-south-1 (Mumbai — closest to Pakistan)
5. Block all public access: ON (files served via signed URLs only)
6. Create bucket

For production bucket:
Bucket name: docquiz-uploads-prod
Same settings
```

### Step 6.2 — Create IAM User (Browser)

```
AWS Console → IAM → Users → Create User
Name: docquiz-s3-user
Permissions: Attach policies directly
Policy: AmazonS3FullAccess (or create custom policy below)

Custom policy (more secure):
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::docquiz-uploads-*",
      "arn:aws:s3:::docquiz-uploads-*/*"
    ]
  }]
}

After creating user:
→ Security credentials tab
→ Create Access Key
→ Use case: Application running outside AWS
→ COPY Access Key ID and Secret — you won't see the secret again
```

---

## Part 7 — Expo / React Native Deployment

### Step 7.1 — Development (No Setup Needed)

```bash
cd mobile
npx expo start

# Scan QR code with Expo Go app on your phone
# App hot-reloads on every file save
# Works on iOS and Android simultaneously
```

### Step 7.2 — EAS Build Setup (One Time, Browser + Terminal)

```bash
# Terminal
npm install -g eas-cli
eas login

# In your mobile/ folder
eas build:configure
# Creates eas.json — commit this file
```

**`mobile/eas.json`:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 7.3 — Build for Testing (Terminal)

```bash
# Build Android APK for testers (no Play Store needed)
eas build --platform android --profile preview

# Build iOS for TestFlight
eas build --platform ios --profile preview

# Build both at once
eas build --platform all --profile preview

# EAS sends you a download link when done (~10-15 min)
# Share the APK link directly with testers on Android
# Submit iOS build to TestFlight in App Store Connect
```

### Step 7.4 — Production Build + Store Submit (Terminal)

```bash
# Production builds
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios      # submits to App Store Connect
eas submit --platform android  # submits to Play Store

# Or combined
eas submit --platform all
```

---

## Part 8 — Environment Variables Summary

### Never commit `.env` files. Use these templates:

**`backend/.env.example`** (commit this, not `.env`):
```bash
# Server
PORT=4000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/docquiz

# Auth
JWT_SECRET=change-this-to-minimum-32-character-random-string
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=docquiz-uploads-dev

# Internal services
AI_SERVICE_URL=http://localhost:8000
```

**`ai-service/.env.example`:**
```bash
# AI APIs
ANTHROPIC_API_KEY=sk-ant-
ASSEMBLYAI_API_KEY=

# Storage
CHROMA_PERSIST_PATH=./chroma_data
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=docquiz-uploads-dev

# Server
ENVIRONMENT=development
PORT=8000
```

**`mobile/.env.example`:**
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_APP_ENV=development
```

---

## Part 9 — Deployment Checklist Per Sprint

### Before pushing to `main` (production):

```
Code
 [ ] All tests pass locally
 [ ] No console.log left in production code
 [ ] No hardcoded API keys or secrets
 [ ] .env files are in .gitignore

Backend
 [ ] Health check endpoint responds 200
 [ ] Auth endpoints tested with Postman
 [ ] Error handling returns proper status codes

AI Service
 [ ] /health endpoint responds
 [ ] Document processing tested with a real PDF
 [ ] Claude API key has sufficient credits

Database
 [ ] MongoDB Atlas connection works from Railway IP
 [ ] Indexes created on frequently queried fields
 [ ] No sensitive data in test documents

Vercel (Landing)
 [ ] Build passes with no errors
 [ ] SEO meta tags visible in page source
 [ ] Mobile responsive on phone browser
```

---

## Part 10 — Monitoring & Logs

### Railway Logs (Terminal)

```bash
# Live logs for backend
railway logs --service backend --tail

# Live logs for AI service
railway logs --service ai-service --tail

# Last 100 lines
railway logs --service backend -n 100
```

### Railway Logs (Browser)

```
Railway Dashboard → Service → Deployments → View Logs
Filter by: ERROR, WARN, INFO
```

### Vercel Logs (Browser)

```
Vercel Dashboard → Project → Functions → View logs
Real-time request logs available in Vercel Pro
```

### Add Sentry for Error Tracking (Optional but Recommended)

```bash
# Backend
npm install @sentry/node
# Add to server.js: Sentry.init({ dsn: process.env.SENTRY_DSN })

# React Native
npx expo install @sentry/react-native
```

---

## Part 11 — Cost Estimate (Monthly)

| Service | Free Tier | Paid (Dev) |
|---|---|---|
| Vercel | Free (100GB bandwidth) | $0 |
| Railway | $5 free credit | ~$5–10/mo |
| MongoDB Atlas | M0 Free (512MB) | $0 |
| AWS S3 | 5GB free | ~$0.02/GB |
| AssemblyAI | $0.37/hr audio | Pay per use |
| Anthropic API | Pay per use | ~$5–20/mo |
| Expo EAS Build | 30 builds/mo free | $0 |
| **Total dev phase** | | **~$10–35/mo** |

---

## Quick Reference — Daily Commands

```bash
# Start local dev
docker-compose up

# Push and deploy (triggers auto-deploy on Railway + Vercel)
git add . && git commit -m "feat: your message" && git push origin main

# Check Railway deployment status
railway status

# View live backend logs
railway logs --tail

# Build Expo app for testing
eas build --platform android --profile preview

# Check Vercel deployment
vercel ls
```

---

*Last updated: 2025 | Platforms: Vercel · Railway · MongoDB Atlas · AWS S3 · Expo EAS*
