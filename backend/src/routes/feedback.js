const express = require('express');
const router = express.Router();
const store = require('../services/lanceDb');
const User = require('../models/User');
const { generateText, parseJsonResponse } = require('../services/geminiService');
const { feedbackPrompt } = require('../prompts/templates');

/**
 * POST /api/feedback/:sessionId
 * Analyze all answers in a session and return AI feedback + scores.
 * The session does NOT need to be marked completed first — useful for mid-session previews.
 * On first completion, user stats in MongoDB are updated.
 *
 * Response:
 * {
 *   overall: number,
 *   grade: string,
 *   summary: string,
 *   dimensions: { clarity, confidence, relevance, grammar, vocabulary },
 *   questions: [{ id, score, strengths[], improvements[], suggestedPhrase }],
 *   topTips: string[]
 * }
 */
router.post('/:sessionId', async (req, res, next) => {
  try {
    const session = await store.read(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    if (session.answers.length === 0) {
      return res.status(422).json({
        error: 'No answers recorded yet. Answer at least one question before requesting feedback.',
      });
    }

    // Build pairs: question + matching transcript
    const pairs = session.questions.map((q) => {
      const answer = session.answers.find((a) => a.questionId === q.id);
      return {
        question: q.text,
        transcript: answer ? answer.transcript : null,
        hint: q.hint || [],
      };
    });

    const prompt = feedbackPrompt(pairs);
    const raw = await generateText(prompt);
    const feedback = parseJsonResponse(raw);

    // Track whether this is the first time feedback is generated for this session
    const isFirstCompletion = session.status !== 'completed';

    // Persist feedback + mark session completed in LanceDB
    await store.completeSession(session.id, feedback);

    // Update MongoDB User stats only on first completion (avoid double-counting on retries)
    if (isFirstCompletion && req.userId) {
      try {
        const user = await User.findById(req.userId);
        if (user) {
          const prev = user.stats;
          const answeredCount = session.answers.filter((a) => a.transcript).length;
          const newTotalSessions = prev.totalSessions + 1;
          const newAvgScore = Math.round(
            ((prev.avgScore * prev.totalSessions) + feedback.overall) / newTotalSessions,
          );

          // ── Streak computation ─────────────────────────────────────────────
          const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
          const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);
          const lastDate       = prev.lastSessionDate ? new Date(prev.lastSessionDate) : null;
          if (lastDate) lastDate.setHours(0, 0, 0, 0);

          let newStreak;
          if (!lastDate) {
            newStreak = 1;                                          // first ever session
          } else if (lastDate.getTime() === todayStart.getTime()) {
            newStreak = prev.streak;                                // already completed one today
          } else if (lastDate.getTime() === yesterdayStart.getTime()) {
            newStreak = prev.streak + 1;                            // consecutive day
          } else {
            newStreak = 1;                                          // streak broken
          }

          await User.findByIdAndUpdate(req.userId, {
            $set: {
              'stats.totalSessions':   newTotalSessions,
              'stats.avgScore':        newAvgScore,
              'stats.bestScore':       Math.max(prev.bestScore, feedback.overall),
              'stats.totalQuestions':  prev.totalQuestions + session.questions.length,
              'stats.totalAnswered':   prev.totalAnswered  + answeredCount,
              'stats.streak':          newStreak,
              'stats.lastSessionDate': todayStart,
            },
          });
        }
      } catch (statsErr) {
        // Stats update is non-critical — log and continue
        console.error('Failed to update user stats:', statsErr.message);
      }
    }

    res.json(feedback);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
