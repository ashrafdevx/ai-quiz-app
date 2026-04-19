const express = require('express');
const router = express.Router();
const store = require('../services/lanceDb');

/**
 * POST /api/sessions
 * Create a new interview session.
 * Body: { documentName, extractedText, questions, interviewType, difficulty }
 */
router.post('/', async (req, res, next) => {
  const { documentName, extractedText, questions, interviewType, difficulty } = req.body;

  if (!extractedText || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      error: 'Provide "extractedText" and a non-empty "questions" array.',
    });
  }

  try {
    const session = await store.createSession({
      documentName: documentName || 'Untitled Document',
      extractedText,
      questions,
      interviewType: interviewType || 'mixed',
      difficulty: difficulty || 'mid',
    });

    // Don't return the full extractedText in the response
    const { extractedText: _, ...response } = session;
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions
 * List all sessions (no extractedText in response).
 */
router.get('/', async (req, res, next) => {
  try {
    res.json(await store.listSessions());
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions/:id
 * Get a full session by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const session = await store.read(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const { extractedText: _, ...response } = session;
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/sessions/:id/answer
 * Save an answer to a specific question.
 * Body: { questionId: number, transcript: string|null }
 * Pass transcript: null to mark a question as skipped.
 */
router.put('/:id/answer', async (req, res, next) => {
  const { questionId, transcript } = req.body;

  if (questionId === undefined || questionId === null) {
    return res.status(400).json({ error: 'Provide "questionId".' });
  }

  try {
    const session = await store.saveAnswer(req.params.id, questionId, transcript ?? null);
    const { extractedText: _, ...response } = session;
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/:id/complete
 * Mark session as completed (call this before generating feedback).
 */
router.post('/:id/complete', async (req, res, next) => {
  try {
    const session = await store.read(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'Session is already completed.' });
    }

    const updated = await store.completeSession(req.params.id, null);
    const { extractedText: _, ...response } = updated;
    res.json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
