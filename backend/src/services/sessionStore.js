/**
 * File-based session store.
 * Each session is a JSON file in /sessions/{id}.json
 * No database required.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SESSIONS_DIR = path.join(__dirname, '../../sessions');

function sessionPath(id) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

function read(id) {
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function write(session) {
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

/**
 * Create a new session.
 * @param {object} opts
 * @param {string} opts.documentName
 * @param {string} opts.extractedText
 * @param {Array}  opts.questions
 * @param {string} opts.interviewType
 * @param {string} opts.difficulty
 */
function createSession({ documentName, extractedText, questions, interviewType, difficulty }) {
  const session = {
    id: uuidv4(),
    documentName,
    extractedText,
    interviewType,
    difficulty,
    questions,
    answers: [],          // { questionId, transcript, recordedAt }[]
    status: 'in_progress',// 'in_progress' | 'completed'
    feedback: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  return write(session);
}

/**
 * Save a single answer.
 * @param {string} sessionId
 * @param {number} questionId
 * @param {string|null} transcript  null if skipped
 */
function saveAnswer(sessionId, questionId, transcript) {
  const session = read(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Replace existing answer for this question, or push new
  const idx = session.answers.findIndex((a) => a.questionId === questionId);
  const entry = { questionId, transcript, recordedAt: new Date().toISOString() };
  if (idx >= 0) {
    session.answers[idx] = entry;
  } else {
    session.answers.push(entry);
  }
  return write(session);
}

/**
 * Attach feedback and mark session completed.
 */
function completeSession(sessionId, feedback) {
  const session = read(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.status = 'completed';
  session.completedAt = new Date().toISOString();
  session.feedback = feedback;
  return write(session);
}

/**
 * List all sessions, newest first, without extractedText (too large).
 */
function listSessions() {
  return fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json') && f !== '.gitkeep')
    .map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
      const { extractedText, ...summary } = s;
      return summary;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { createSession, read, saveAnswer, completeSession, listSessions };
