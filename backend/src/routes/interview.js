const express = require('express');
const fs = require('fs');
const router = express.Router();

const audioUpload = require('../middleware/audioUpload');
const InterviewSession = require('../models/InterviewSession');
const { generateText, parseJsonResponse, transcribeAudio } = require('../services/geminiService');
const {
  interviewStartPrompt,
  interviewNextQuestionPrompt,
  interviewEvalPrompt,
} = require('../prompts/templates');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract all AI question texts from a session's messages. */
function getPreviousQuestions(session) {
  return session.messages
    .filter(m => m.role === 'ai')
    .map(m => m.content);
}

/** Run Groq evaluation and return a parsed evaluation object. */
async function evaluateAnswer(topic, question, answer) {
  const raw = await generateText(interviewEvalPrompt(topic, question, answer));
  return parseJsonResponse(raw);
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/interview/start
 * Body: { topic }
 * Detects category, generates first question, creates session.
 */
router.post('/start', async (req, res, next) => {
  try {
    const { topic } = req.body;
    if (!topic?.trim()) {
      return res.status(400).json({ success: false, message: 'Topic is required.', code: 'INVALID_INPUT' });
    }

    const raw = await generateText(interviewStartPrompt(topic.trim()));
    const { category, question } = parseJsonResponse(raw);

    const session = await InterviewSession.create({
      userId: req.userId,
      topic:  topic.trim(),
      category: category ?? 'other',
      messages: [{
        role:          'ai',
        content:       question,
        questionIndex: 0,
      }],
      questionCount: 1,
    });

    res.status(201).json({
      sessionId: session._id,
      category:  session.category,
      question,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/:id/answer
 * Body: { answer, questionIndex, inputMode? }
 * Evaluates the answer and appends user + feedback messages.
 */
router.post('/:id/answer', async (req, res, next) => {
  try {
    const { answer, questionIndex, inputMode = 'text' } = req.body;

    if (!answer?.trim()) {
      return res.status(400).json({ success: false, message: 'Answer cannot be empty.', code: 'INVALID_INPUT' });
    }

    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.', code: 'NOT_FOUND' });
    if (session.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Session already completed.', code: 'CONFLICT' });
    }

    const question = session.messages.find(
      m => m.role === 'ai' && m.questionIndex === questionIndex
    )?.content ?? '';

    const evaluation = await evaluateAnswer(session.topic, question, answer.trim());

    session.messages.push(
      { role: 'user',     content: answer.trim(), questionIndex, inputMode },
      { role: 'feedback', content: '', questionIndex, evaluation: {
        score:         evaluation.score ?? 0,
        feedback:      evaluation.feedback ?? '',
        mistakes:      evaluation.mistakes ?? [],
        improvements:  evaluation.improvements ?? [],
        improvedAnswer:evaluation.improvedAnswer ?? '',
      }},
    );

    session.recalcAvgScore();
    await session.save();

    res.json({ evaluation });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/:id/voice
 * Multipart: audio file + questionIndex
 * Transcribes audio then evaluates as answer.
 */
router.post('/:id/voice', audioUpload.single('audio'), async (req, res, next) => {
  const audioPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file received.', code: 'MISSING_AUDIO' });
    }

    const questionIndex = parseInt(req.body.questionIndex, 10);
    if (isNaN(questionIndex)) {
      return res.status(400).json({ success: false, message: 'Provide a valid questionIndex.', code: 'INVALID_INPUT' });
    }

    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.', code: 'NOT_FOUND' });
    if (session.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Session already completed.', code: 'CONFLICT' });
    }

    const transcript = await transcribeAudio(audioPath);
    const question = session.messages.find(
      m => m.role === 'ai' && m.questionIndex === questionIndex
    )?.content ?? '';

    const evaluation = await evaluateAnswer(session.topic, question, transcript);

    session.messages.push(
      { role: 'user',     content: transcript, questionIndex, inputMode: 'voice', voiceTranscript: transcript },
      { role: 'feedback', content: '', questionIndex, evaluation: {
        score:         evaluation.score ?? 0,
        feedback:      evaluation.feedback ?? '',
        mistakes:      evaluation.mistakes ?? [],
        improvements:  evaluation.improvements ?? [],
        improvedAnswer:evaluation.improvedAnswer ?? '',
      }},
    );

    session.recalcAvgScore();
    await session.save();

    res.json({ transcript, evaluation });
  } catch (err) {
    next(err);
  } finally {
    if (audioPath) fs.unlink(audioPath, () => {});
  }
});

/**
 * POST /api/interview/:id/next
 * Generates the next question and appends it to the session.
 */
router.post('/:id/next', async (req, res, next) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.', code: 'NOT_FOUND' });
    if (session.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Session already completed.', code: 'CONFLICT' });
    }

    const previousQuestions = getPreviousQuestions(session);
    const raw = await generateText(
      interviewNextQuestionPrompt(session.topic, session.category, previousQuestions)
    );
    const { question } = parseJsonResponse(raw);

    const nextIndex = session.questionCount; // 0-based
    session.messages.push({ role: 'ai', content: question, questionIndex: nextIndex });
    session.questionCount += 1;
    await session.save();

    res.json({ question, questionIndex: nextIndex });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/:id/complete
 * Marks session as completed and returns final stats.
 */
router.post('/:id/complete', async (req, res, next) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.', code: 'NOT_FOUND' });

    session.status = 'completed';
    session.completedAt = new Date();
    session.recalcAvgScore();
    await session.save();

    const answeredCount = session.messages.filter(m => m.role === 'user').length;

    res.json({
      sessionId:     session._id,
      topic:         session.topic,
      category:      session.category,
      questionCount: session.questionCount,
      answeredCount,
      avgScore:      session.avgScore,
      completedAt:   session.completedAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interview/:id
 * Returns the full session (messages included).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.', code: 'NOT_FOUND' });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interview
 * Lists all interview sessions for the authenticated user (newest first).
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip  = parseInt(req.query.skip) || 0;

    const sessions = await InterviewSession.find({ userId: req.userId })
      .select('-messages')      // omit chat log for list view
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
