const express = require('express');
const fs = require('fs');
const router = express.Router();

const audioUpload = require('../middleware/audioUpload');
const store = require('../services/lanceDb');
const { transcribeAudio, generateText, parseJsonResponse } = require('../services/geminiService');
const { singleAnswerEvalPrompt } = require('../prompts/templates');

// ── Speech quality helpers ───────────────────────────────────────────────────

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually', 'right', 'so'];

function analyzeSpeech(transcript, durationSeconds) {
  if (!transcript || transcript.trim().length === 0) {
    return { wordCount: 0, wpm: 0, fillerCount: 0, fillerWords: [], uniqueWordRatio: 0 };
  }

  const lower = transcript.toLowerCase();
  const words = lower.match(/\b\w+\b/g) || [];
  const wordCount = words.length;

  const wpm = durationSeconds && durationSeconds > 0
    ? Math.round((wordCount / durationSeconds) * 60)
    : null;

  const foundFillers = FILLER_WORDS.filter(f => lower.includes(f));
  const fillerCount = foundFillers.reduce((acc, f) => {
    const re = new RegExp(`\\b${f}\\b`, 'gi');
    return acc + (lower.match(re) || []).length;
  }, 0);

  const uniqueWords = new Set(words);
  const uniqueWordRatio = wordCount > 0 ? Math.round((uniqueWords.size / wordCount) * 100) : 0;

  return { wordCount, wpm, fillerCount, fillerWords: foundFillers, uniqueWordRatio };
}

/**
 * Compute a 0-100 speech score from raw speech metrics.
 * Weights: clarity (vocab diversity) 40%, filler penalty 35%, WPM pace 25%.
 */
function computeSpeechScore(wpm, fillerCount, uniqueWordRatio) {
  // WPM score — ideal range is 120-160 wpm
  let wpmScore;
  if (!wpm || wpm === 0) {
    wpmScore = 70; // neutral when duration is unknown
  } else if (wpm < 80) {
    wpmScore = Math.round((wpm / 80) * 60);
  } else if (wpm < 120) {
    wpmScore = Math.round(60 + ((wpm - 80) / 40) * 40);
  } else if (wpm <= 160) {
    wpmScore = 100;
  } else if (wpm <= 200) {
    wpmScore = Math.round(100 - ((wpm - 160) / 40) * 20);
  } else {
    wpmScore = Math.max(40, Math.round(80 - ((wpm - 200) / 50) * 40));
  }

  // Filler penalty
  const fillerScore = fillerCount === 0 ? 100
    : fillerCount <= 2 ? 80
    : fillerCount <= 5 ? 60
    : fillerCount <= 10 ? 40
    : 20;

  // Clarity proxy from vocabulary diversity (uniqueWordRatio is already 0-100)
  const clarityScore = Math.min(100, Math.round(uniqueWordRatio * 1.2));

  return Math.round(clarityScore * 0.40 + fillerScore * 0.35 + wpmScore * 0.25);
}

/** Sprint 5 composite: content drives 70%, speech delivery drives 30% */
function computeCompositeScore(contentScore, speechScore) {
  return Math.round(contentScore * 0.70 + speechScore * 0.30);
}

// ── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/sessions/:id/voice-answer
 *
 * Multipart form fields:
 *   audio      (file)    — recorded audio clip
 *   questionId (string)  — numeric id of the question being answered
 *   duration   (string)  — optional, recording length in seconds
 *
 * Response:
 * {
 *   transcript: string,
 *   speechQuality: { wordCount, wpm, fillerCount, fillerWords, uniqueWordRatio },
 *   evaluation: { score, strengths, improvements, suggestedPhrase },
 *   questionId: number
 * }
 */
router.post('/:id/voice-answer', audioUpload.single('audio'), async (req, res, next) => {
  const audioPath = req.file?.path;

  try {
    // ── Validate ──────────────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file received.', code: 'MISSING_AUDIO' });
    }

    const questionId = parseInt(req.body.questionId, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ success: false, message: 'Provide a valid questionId.', code: 'INVALID_INPUT' });
    }

    const duration = parseFloat(req.body.duration) || null;

    // ── Load session ──────────────────────────────────────────────────────
    const session = await store.read(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.', code: 'NOT_FOUND' });
    }
    if (session.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Session is already completed.', code: 'CONFLICT' });
    }

    const question = session.questions.find(q => q.id === questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: `Question ${questionId} not found in session.`, code: 'NOT_FOUND' });
    }

    // ── Transcribe ────────────────────────────────────────────────────────
    const transcript = await transcribeAudio(audioPath);

    // ── Speech quality + speech score ─────────────────────────────────────
    const speechQuality = analyzeSpeech(transcript, duration);
    const speechScore = computeSpeechScore(
      speechQuality.wpm,
      speechQuality.fillerCount,
      speechQuality.uniqueWordRatio,
    );

    // ── Evaluate answer (content) ─────────────────────────────────────────
    const prompt = singleAnswerEvalPrompt(question.text, transcript, question.hint || []);
    const raw = await generateText(prompt);
    const evaluation = parseJsonResponse(raw);

    // ── Composite score ───────────────────────────────────────────────────
    const contentScore = Math.round((evaluation.score ?? 5) * 10); // 1-10 → 0-100
    const compositeScore = computeCompositeScore(contentScore, speechScore);

    // ── Persist transcript ────────────────────────────────────────────────
    await store.saveAnswer(req.params.id, questionId, transcript);

    res.json({ transcript, speechQuality, evaluation, questionId, contentScore, speechScore, compositeScore });
  } catch (err) {
    next(err);
  } finally {
    // Always clean up the uploaded audio file — we don't store audio long-term
    if (audioPath) {
      fs.unlink(audioPath, () => {});
    }
  }
});

module.exports = router;
