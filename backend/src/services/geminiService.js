/**
 * AI service layer.
 *
 * Routing:
 *   generateText      → Groq  (llama-3.3-70b-versatile)   — 14,400 req/day free
 *   generateFromFile  → Gemini (2.0-flash / 1.5-flash)    — multimodal for scanned PDFs
 *   embedText         → Gemini (embedding-001)             — 100 req/day free
 *
 * Gemini is kept only for the two tasks that need it so the 1,500 RPD
 * generative quota is no longer touched during normal app use.
 */

const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Model lists ──────────────────────────────────────────────────────────────

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',  // primary: best quality, 128K context
  'llama3-70b-8192',          // fallback: proven, 8K context
];

const GEMINI_VISION_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const EMBEDDING_MODEL  = 'gemini-embedding-001';
const EMBEDDING_DIM    = 768;

// ── Lazy clients ─────────────────────────────────────────────────────────────

let _groq    = null;
let _gemini  = null;

function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Add it to your .env file.');
  }
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

function getGemini() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
  }
  if (!_gemini) _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _gemini;
}

// ── Error classifiers ────────────────────────────────────────────────────────

function isQuotaError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    err?.status === 429 ||
    err?.statusCode === 429 ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('resource_exhausted')
  );
}

function isModelNotFoundError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    err?.status === 404 ||
    err?.statusCode === 404 ||
    msg.includes('[404') ||
    msg.includes('is not found') ||
    msg.includes('is not supported for generatecontent')
  );
}

/**
 * Returns milliseconds to wait from Groq's retry-after header or Gemini's
 * message hint. Returns null if no hint is found (treat as daily quota).
 */
function parseRetryAfterMs(err) {
  // Groq SDK surfaces the header directly
  const header = err?.headers?.['retry-after'] ?? err?.headers?.['x-ratelimit-reset-requests'];
  if (header) return parseInt(header, 10) * 1000;

  // Gemini embeds it in the message
  const msg = String(err?.message ?? '');
  const match = msg.match(/retry[^0-9]*(\d+)\s*second/i);
  return match ? parseInt(match[1], 10) * 1000 : null;
}

function isDailyQuotaError(err) {
  if (!isQuotaError(err)) return false;
  const retryMs = parseRetryAfterMs(err);
  return retryMs === null || retryMs > 60_000;
}

// ── Retry wrapper ────────────────────────────────────────────────────────────

/**
 * Retry a provider call on per-minute rate limits (RPM).
 * Daily quota exhaustion is detected but NOT retried — no point waiting hours.
 */
async function withRetry(fn, maxAttempts = 3) {
  let hitDailyQuota = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isQuotaError(err)) throw err;

      const retryMs = parseRetryAfterMs(err);

      if (retryMs === null || retryMs > 60_000) {
        hitDailyQuota = true;
        break;
      }
      if (attempt === maxAttempts) break;

      console.warn(`[AI] Rate limited. Retrying in ${retryMs}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, retryMs + 200));
    }
  }

  const message = hitDailyQuota
    ? 'Daily AI request limit reached. Please try again in a few hours.'
    : 'Server is busy. Please try again in a moment.';

  throw Object.assign(new Error(message), { status: 429, isDailyQuota: hitDailyQuota });
}

// ── Shared fallback helpers ──────────────────────────────────────────────────

function canFallback(err, index, models) {
  if (index >= models.length - 1) return false;
  return err.status === 429 || isModelNotFoundError(err);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a plain text prompt and get a text response.
 * Uses Groq — 14,400 req/day free.
 *
 * @param {string} prompt
 * @param {number} [_idx]  internal — do not pass
 * @returns {Promise<string>}
 */
async function generateText(prompt, _idx = 0) {
  const model = GROQ_MODELS[_idx] ?? GROQ_MODELS[GROQ_MODELS.length - 1];

  try {
    return await withRetry(async () => {
      const res = await getGroq().chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      return res.choices[0]?.message?.content ?? '';
    });
  } catch (err) {
    if (canFallback(err, _idx, GROQ_MODELS)) {
      const next = GROQ_MODELS[_idx + 1];
      console.warn(`[AI:Groq] ${model} unavailable — falling back to ${next}`);
      return generateText(prompt, _idx + 1);
    }
    // All Groq models exhausted
    if (err.isDailyQuota) {
      throw Object.assign(
        new Error('Daily AI request limit reached. Please try again in a few hours.'),
        { status: 429 }
      );
    }
    throw err;
  }
}

/**
 * Send a prompt alongside a raw file buffer and get a text response.
 * Uses Gemini (multimodal) — only called as a fallback for scanned PDFs
 * when pdf-parse cannot extract text.
 *
 * @param {string} prompt
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {number} [_idx]  internal — do not pass
 * @returns {Promise<string>}
 */
async function generateFromFile(prompt, fileBuffer, mimeType, _idx = 0) {
  const model = GEMINI_VISION_MODELS[_idx] ?? GEMINI_VISION_MODELS[GEMINI_VISION_MODELS.length - 1];

  try {
    return await withRetry(async () => {
      const geminiModel = getGemini().getGenerativeModel({ model });
      const result = await geminiModel.generateContent([
        { inlineData: { data: fileBuffer.toString('base64'), mimeType } },
        prompt,
      ]);
      return result.response.text();
    });
  } catch (err) {
    if (canFallback(err, _idx, GEMINI_VISION_MODELS)) {
      const next = GEMINI_VISION_MODELS[_idx + 1];
      const reason = isModelNotFoundError(err) ? 'not available' : 'quota exhausted';
      console.warn(`[AI:Gemini] ${model} ${reason} — falling back to ${next}`);
      return generateFromFile(prompt, fileBuffer, mimeType, _idx + 1);
    }
    if (isModelNotFoundError(err)) {
      throw Object.assign(
        new Error('AI service is temporarily unavailable. Please try again later.'),
        { status: 503 }
      );
    }
    throw err;
  }
}

/**
 * Parse a JSON response, stripping markdown fences if present.
 * @param {string} raw
 * @returns {object}
 */
function parseJsonResponse(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Generate a 768-dimensional embedding for a text string.
 * Uses Gemini embedding-001 — quota is separate from generation (100 req/day free).
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  const model = getGemini().getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    outputDimensionality: EMBEDDING_DIM,
  });
  return result.embedding.values;
}

module.exports = { generateText, generateFromFile, parseJsonResponse, embedText };
