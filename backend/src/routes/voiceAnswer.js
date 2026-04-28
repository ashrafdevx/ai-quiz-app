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

    // ── Speech quality ────────────────────────────────────────────────────
    const speechQuality = analyzeSpeech(transcript, duration);

    // ── Evaluate answer ───────────────────────────────────────────────────
    const prompt = singleAnswerEvalPrompt(question.text, transcript, question.hint || []);
    const raw = await generateText(prompt);
    const evaluation = parseJsonResponse(raw);

    // ── Persist transcript ────────────────────────────────────────────────
    await store.saveAnswer(req.params.id, questionId, transcript);

    res.json({ transcript, speechQuality, evaluation, questionId });
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
