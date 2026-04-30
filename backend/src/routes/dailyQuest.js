const express = require('express');
const router = express.Router();
const DailyQuestPlan  = require('../models/DailyQuestPlan');
const DailyQuestEntry = require('../models/DailyQuestEntry');
const { generateText, parseJsonResponse } = require('../services/geminiService');
const { dailyQuestGenerationPrompt, dailyQuestEvalPrompt } = require('../prompts/templates');

/** Returns a Date set to the start of today in UTC. */
function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── GET /api/daily-quest/today ────────────────────────────────────────────────
// Returns (or generates) today's 5-question plan for the authenticated user.
// Already-answered questions include the full entry for immediate feedback display.

router.get('/today', async (req, res, next) => {
  try {
    const date = todayUTC();
    let plan = await DailyQuestPlan.findOne({ userId: req.userId, date });

    if (!plan) {
      const raw = await generateText(dailyQuestGenerationPrompt(5));
      const { questions } = parseJsonResponse(raw);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('AI returned empty question set.');
      }
      plan = await DailyQuestPlan.create({ userId: req.userId, date, questions });
    }

    // Embed full entry data for answered questions so the frontend can show feedback on re-open
    const entries = await DailyQuestEntry.find({ userId: req.userId, planId: plan._id }).lean();
    const entryByQuestionId = Object.fromEntries(entries.map(e => [e.questionId, e]));

    const planObj = plan.toObject();
    planObj.questions = planObj.questions.map(q => ({
      ...q,
      entry: entryByQuestionId[q.id] ?? null,
    }));

    res.json(planObj);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/daily-quest/submit ──────────────────────────────────────────────
// Submits and evaluates one answer. Idempotency: returns 409 if already answered.

router.post('/submit', async (req, res, next) => {
  try {
    const { planId, questionId, userAnswer } = req.body;

    if (!planId || questionId == null || !String(userAnswer ?? '').trim()) {
      return res.status(400).json({ error: 'planId, questionId, and userAnswer are required.' });
    }

    const plan = await DailyQuestPlan.findOne({ _id: planId, userId: req.userId });
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    const q = plan.questions.find(q => q.id === Number(questionId));
    if (!q) return res.status(404).json({ error: 'Question not found in plan.' });
    if (q.answered) return res.status(409).json({ error: 'Question already answered.' });

    // AI evaluation
    const raw = await generateText(
      dailyQuestEvalPrompt(q.question, userAnswer.trim(), q.correctAnswer, q.tips)
    );
    const evaluation = parseJsonResponse(raw);

    const isCorrect = evaluation.isCorrect ?? (evaluation.score >= 60);
    const score     = Math.min(100, Math.max(0, Math.round(evaluation.score ?? (isCorrect ? 80 : 30))));
    const feedback  = evaluation.feedback ?? '';

    // Persist entry (unique index prevents duplicate submissions)
    const entry = await DailyQuestEntry.create({
      userId:        req.userId,
      planId:        plan._id,
      date:          plan.date,
      questionId:    q.id,
      question:      q.question,
      userAnswer:    userAnswer.trim(),
      correctAnswer: q.correctAnswer,
      tips:          q.tips,
      topic:         q.topic,
      difficulty:    q.difficulty,
      isCorrect,
      score,
      feedback,
      completedAt:   new Date(),
    });

    // Mark answered in the plan
    await DailyQuestPlan.updateOne(
      { _id: plan._id, 'questions.id': q.id },
      { $set: { 'questions.$.answered': true, 'questions.$.entryId': entry._id } }
    );

    res.json({
      entry,
      isCorrect,
      score,
      correctAnswer: q.correctAnswer,
      tips:          q.tips,
      feedback,
    });
  } catch (err) {
    // Handle duplicate submission race condition
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Question already answered.' });
    }
    next(err);
  }
});

// ── GET /api/daily-quest/history ──────────────────────────────────────────────
// Returns all entries grouped by UTC day, newest first, with per-day stats.

router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const skip  = parseInt(req.query.skip)  || 0;

    const entries = await DailyQuestEntry
      .find({ userId: req.userId })
      .sort({ date: -1, completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Group by UTC date string
    const grouped = new Map();
    for (const entry of entries) {
      const key = entry.date.toISOString().slice(0, 10);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(entry);
    }

    const days = Array.from(grouped.entries()).map(([dateKey, dayEntries]) => {
      const correct  = dayEntries.filter(e => e.isCorrect).length;
      const avgScore = Math.round(dayEntries.reduce((s, e) => s + e.score, 0) / dayEntries.length);
      return { date: dateKey, entries: dayEntries, correct, total: dayEntries.length, avgScore };
    });

    const total = await DailyQuestEntry.countDocuments({ userId: req.userId });

    res.json({ days, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
