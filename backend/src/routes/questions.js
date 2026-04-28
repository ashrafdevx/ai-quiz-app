const express = require('express');
const router = express.Router();
const { generateText, parseJsonResponse } = require('../services/geminiService');
const { questionGenerationPrompt } = require('../prompts/templates');

/**
 * POST /api/questions/generate
 * Body JSON:
 * {
 *   text: string           — extracted document text
 *   count: number          — 3–10 (default 5)
 *   type: string           — 'technical'|'behavioral'|'hr'|'mixed' (default 'mixed')
 *   difficulty: string     — 'junior'|'mid'|'senior' (default 'mid')
 *   focusAreas: string[]   — optional, e.g. ['React Native', 'system design']
 * }
 */
router.post('/generate', async (req, res, next) => {
  const { text, count = 5, type = 'mixed', difficulty = 'mid', focusAreas = [] } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return res.status(400).json({
      success: false,
      message: 'Please provide document text (at least 50 characters).',
      code: 'INVALID_INPUT',
    });
  }

  const questionCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 10);

  const validTypes = ['technical', 'behavioral', 'hr', 'mixed'];
  const validDifficulties = ['junior', 'mid', 'senior'];

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Question type must be one of: ${validTypes.join(', ')}.`,
      code: 'INVALID_INPUT',
    });
  }
  if (!validDifficulties.includes(difficulty)) {
    return res.status(400).json({
      success: false,
      message: `Difficulty must be one of: ${validDifficulties.join(', ')}.`,
      code: 'INVALID_INPUT',
    });
  }

  try {
    const prompt = questionGenerationPrompt(text, {
      count: questionCount,
      type,
      difficulty,
      focusAreas,
    });

    const raw = await generateText(prompt);
    const parsed = parseJsonResponse(raw);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Gemini did not return a valid questions array.');
    }

    res.json({
      count: parsed.questions.length,
      type,
      difficulty,
      questions: parsed.questions,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
