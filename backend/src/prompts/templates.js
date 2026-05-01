/**
 * Prompt templates for Gemini API calls.
 * All prompts instruct Gemini to return strict JSON — no markdown fences.
 */

/**
 * Builds the prompt to extract clean text from a document.
 * Used when Gemini processes the raw PDF bytes directly.
 */
const extractionPrompt = () =>
  `Extract all meaningful text from this document.
Remove headers, footers, page numbers, and formatting artifacts.
Return only the clean body text as a single plain-text string.
Do NOT wrap in JSON.`;

/**
 * Builds the prompt to generate interview questions from extracted text.
 * @param {string} text - document content
 * @param {object} opts
 * @param {number} opts.count
 * @param {'technical'|'behavioral'|'hr'|'mixed'} opts.type
 * @param {'junior'|'mid'|'senior'} opts.difficulty
 * @param {string[]} opts.focusAreas
 */
const questionGenerationPrompt = (text, { count, type, difficulty, focusAreas }) => {
  const focus = focusAreas && focusAreas.length > 0
    ? `Focus especially on: ${focusAreas.join(', ')}.`
    : '';

  return `You are a senior ${difficulty}-level technical interviewer.

Document content:
"""
${text.slice(0, 6000)}
"""

Generate exactly ${count} ${type} interview questions for a ${difficulty}-level candidate.
${focus}

Rules:
- Questions must be directly grounded in the document content.
- Each question should require a spoken answer of 60–120 seconds.
- Include a "hint" with 2–3 bullet points the ideal answer should cover.
- Do NOT number the questions in the text field.

Return ONLY valid JSON — no markdown, no explanation:
{
  "questions": [
    {
      "id": 1,
      "text": "question text here",
      "type": "${type}",
      "difficulty": "${difficulty}",
      "hint": ["key point 1", "key point 2", "key point 3"]
    }
  ]
}`;
};

/**
 * Builds the prompt to analyze interview answers and produce structured feedback.
 * @param {Array<{question: string, transcript: string|null, hint: string[]}>} pairs
 */
const feedbackPrompt = (pairs) => {
  const qa = pairs
    .map((p, i) =>
      `Q${i + 1}: ${p.question}
Expected key points: ${p.hint.join('; ')}
Answer transcript: ${p.transcript || '[No answer — question skipped]'}`
    )
    .join('\n\n');

  return `You are an expert English communication coach evaluating a developer's spoken interview answers.

Interview Q&A:
"""
${qa}
"""

Evaluate the candidate's English communication skills across these dimensions (score 1–10):
- clarity:     How clearly ideas are expressed
- confidence:  Use of hedging language, filler words, assertiveness
- relevance:   How well the answer addresses the question
- grammar:     Grammatical correctness and sentence structure
- vocabulary:  Range and appropriateness of vocabulary used

For each question also provide:
- strengths: 1–2 specific things done well
- improvements: 1–2 specific things to improve
- suggestedPhrase: One alternative phrasing that improves the weakest part

Return ONLY valid JSON — no markdown, no explanation:
{
  "overall": <number 0-100>,
  "grade": "<A|B|C|D|F>",
  "summary": "<2-sentence overall summary>",
  "dimensions": {
    "clarity": <1-10>,
    "confidence": <1-10>,
    "relevance": <1-10>,
    "grammar": <1-10>,
    "vocabulary": <1-10>
  },
  "questions": [
    {
      "id": 1,
      "score": <1-10>,
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "suggestedPhrase": "..."
    }
  ],
  "topTips": ["tip 1", "tip 2", "tip 3"]
}`;
};

/**
 * Builds the prompt to evaluate a single spoken answer immediately after recording.
 * @param {string} question
 * @param {string|null} transcript
 * @param {string[]} hints
 */
const singleAnswerEvalPrompt = (question, transcript, hints) =>
  `You are an expert interview coach evaluating a spoken answer.

Question: ${question}
Expected key points: ${hints.join('; ')}
Candidate's answer: ${transcript || '[No answer provided]'}

Evaluate for relevance, completeness, and communication quality.
Return ONLY valid JSON — no markdown, no explanation:
{
  "score": <1-10>,
  "feedback": "<1-2 sentence overall verdict>",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "suggestedPhrase": "...",
  "improvedAnswer": "<a concise model answer of 2-4 sentences covering all key points>"
}`;

// ── Daily Quest prompts ───────────────────────────────────────────────────────

const QUEST_TOPICS = [
  'data structures', 'algorithms', 'system design', 'JavaScript / TypeScript',
  'REST APIs & HTTP', 'SQL & NoSQL databases', 'Git workflow', 'software architecture',
  'behavioral interview skills', 'problem-solving approach', 'code review best practices',
  'testing strategies', 'performance optimization', 'web security fundamentals',
  'object-oriented design', 'functional programming concepts', 'cloud & DevOps basics',
  'React / frontend patterns', 'Node.js / backend patterns', 'concurrency & async programming',
];

/**
 * Generates a daily set of short-answer quiz questions for interview preparation.
 * Topics are randomly sampled so each day's set is different.
 * @param {number} count
 */
const dailyQuestGenerationPrompt = (count = 5) => {
  const shuffled = [...QUEST_TOPICS].sort(() => Math.random() - 0.5);
  const topics   = shuffled.slice(0, count).join(', ');

  return `You are an interview preparation coach creating a daily quiz for software engineers.

Generate exactly ${count} short-answer questions, one per topic from this list: ${topics}

For each question:
- Question: clear and answerable in 2-5 sentences
- Correct answer: 2-4 sentences covering all essential points
- Tips: exactly 3 concise bullet points to remember
- Topic: the exact topic from the list
- Difficulty: "easy", "medium", or "hard"

Return ONLY valid JSON — no markdown, no explanation:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "correctAnswer": "...",
      "tips": ["...", "...", "..."],
      "topic": "...",
      "difficulty": "easy|medium|hard"
    }
  ]
}`;
};

/**
 * Evaluates a user's written answer against the correct answer and tips.
 * Scores generously — partial credit for partial understanding.
 * @param {string} question
 * @param {string} userAnswer
 * @param {string} correctAnswer
 * @param {string[]} tips
 */
const dailyQuestEvalPrompt = (question, userAnswer, correctAnswer, tips) =>
  `You are evaluating a software engineer's answer to an interview preparation question.

Question: ${question}
Correct Answer: ${correctAnswer}
Key Points to Cover: ${(tips ?? []).join(' | ')}
User's Answer: ${userAnswer}

Scoring guide:
- 80-100: Covers all key points, clear explanation
- 60-79: Covers most key points, minor gaps
- 40-59: Covers some key points, significant gaps
- 0-39: Misses most key points or fundamentally wrong

Return ONLY valid JSON — no markdown, no explanation:
{
  "isCorrect": <true if score >= 60, otherwise false>,
  "score": <0-100>,
  "feedback": "<1-2 sentences: what they got right and what was missing>"
}`;

// ── AI Interview prompts ──────────────────────────────────────────────────────

const INTERVIEW_CATEGORIES = [
  'web', 'react-native', 'android', 'devops', 'python', 'java',
  'database', 'system-design', 'behavioral', 'algorithms',
  'javascript', 'typescript', 'other',
];

/**
 * Detects category and generates the first interview question for a given topic.
 * @param {string} topic  — user's free-text prompt
 */
const interviewStartPrompt = (topic) =>
  `You are an expert technical interviewer. The candidate wants to practice: "${topic}"

Tasks:
1. Detect the most fitting category from this list: ${INTERVIEW_CATEGORIES.join(', ')}
2. Generate the FIRST interview question for this topic.

Question rules:
- Open-ended, requires a thoughtful 2–4 sentence answer
- Mid-level difficulty — assume the candidate has 2–3 years of experience
- Clear, concise phrasing — no fluff
- Do NOT number or prefix it

Return ONLY valid JSON — no markdown, no explanation:
{
  "category": "...",
  "question": "..."
}`;

/**
 * Generates the next interview question, aware of what has already been asked.
 * @param {string}   topic
 * @param {string}   category
 * @param {string[]} previousQuestions
 */
const interviewNextQuestionPrompt = (topic, category, previousQuestions) =>
  `You are conducting a ${category} interview on the topic: "${topic}"

Questions already asked (do NOT repeat these):
${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate the NEXT interview question. It must:
- Be entirely different from all previous questions
- Progress naturally in complexity
- Stay within the same topic/category
- Be open-ended, not answerable with yes/no

Return ONLY valid JSON — no markdown, no explanation:
{
  "question": "..."
}`;

/**
 * Immediately evaluates a single answer in the chat interview flow.
 * @param {string} topic
 * @param {string} question
 * @param {string} answer
 */
const interviewEvalPrompt = (topic, question, answer) =>
  `You are an expert interviewer evaluating a candidate's answer.

Topic: ${topic}
Question: ${question}
Candidate's Answer: ${answer || '[No answer provided]'}

Scoring guide:
- 80–100: Excellent — covers all key points with clarity and depth
- 60–79: Good — mostly correct with minor gaps or imprecision
- 40–59: Partial — some correct points but significant gaps
- 0–39: Needs work — major gaps, off-topic, or incorrect

Evaluate on: accuracy, completeness, clarity, and technical depth.

Return ONLY valid JSON — no markdown, no explanation:
{
  "score": <0-100>,
  "feedback": "<2–3 sentence verdict: what was strong and what was missing>",
  "mistakes": ["specific error or gap 1", "specific error or gap 2"],
  "improvements": ["actionable suggestion 1", "actionable suggestion 2"],
  "improvedAnswer": "<model answer in 3–5 sentences showing what an excellent response looks like>"
}`;

module.exports = {
  extractionPrompt,
  questionGenerationPrompt,
  feedbackPrompt,
  singleAnswerEvalPrompt,
  dailyQuestGenerationPrompt,
  dailyQuestEvalPrompt,
  interviewStartPrompt,
  interviewNextQuestionPrompt,
  interviewEvalPrompt,
};
