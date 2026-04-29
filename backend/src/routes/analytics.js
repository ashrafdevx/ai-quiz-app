const express = require('express');
const router = express.Router();
const store = require('../services/lanceDb');
const User = require('../models/User');

/**
 * GET /api/analytics/performance
 *
 * Returns the authenticated user's performance data:
 *   - Score history (last 10 completed sessions, newest first)
 *   - Aggregated stats (avg, best, total, streak)
 *   - Weak topics extracted from per-question improvement notes
 *   - Recent trend ('improving' | 'declining' | 'stable')
 */
router.get('/performance', async (req, res, next) => {
  try {
    const [sessions, user] = await Promise.all([
      store.listSessions(),
      User.findById(req.userId).select('stats name'),
    ]);

    // Only completed sessions with a meaningful score
    const completed = sessions.filter(s => s.status === 'completed' && s.score > 0);

    const scoreHistory = completed.slice(0, 10).map(s => ({
      sessionId:     s.id,
      date:          s.completedAt || s.createdAt,
      score:         s.score,
      documentName:  s.documentName,
      interviewType: s.interviewType,
      difficulty:    s.difficulty,
    }));

    const weakTopics  = extractWeakTopics(completed);
    const recentTrend = computeTrend(completed.slice(0, 6).map(s => s.score));

    const stats = user?.stats ?? {};

    res.json({
      scoreHistory,
      avgScore:      stats.avgScore      ?? 0,
      bestScore:     stats.bestScore     ?? 0,
      totalSessions: stats.totalSessions ?? 0,
      totalAnswered: stats.totalAnswered ?? 0,
      streak:        stats.streak        ?? 0,
      weakTopics,
      recentTrend,
    });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract unique improvement topics from all completed session feedback.
 * Returns up to 6 deduplicated items, most recent first.
 */
function extractWeakTopics(sessions) {
  const seen = new Set();
  const topics = [];

  for (const session of sessions) {
    if (!session.feedback?.questions) continue;
    for (const q of session.feedback.questions) {
      for (const item of (q.improvements ?? [])) {
        const key = item.toLowerCase().slice(0, 50);
        if (!seen.has(key)) {
          seen.add(key);
          topics.push(item);
          if (topics.length >= 6) return topics;
        }
      }
    }
  }

  return topics;
}

/**
 * Compare the average of the most-recent half vs older half of scores.
 * Returns 'improving', 'declining', or 'stable'.
 */
function computeTrend(scores) {
  if (scores.length < 2) return 'stable';

  const mid       = Math.ceil(scores.length / 2);
  const recentAvg = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const olderAvg  = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);

  const diff = recentAvg - olderAvg;
  if (diff >  5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

module.exports = router;
