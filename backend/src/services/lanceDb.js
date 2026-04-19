/**
 * LanceDB session store.
 *
 * Drop-in replacement for sessionStore.js — all exported function signatures
 * are identical so routes require zero changes.
 *
 * Data lives in ./data/lancedb/ (a local directory, no server required).
 * Each session row stores structured fields + a 768-dim Gemini embedding of
 * the document text, enabling semantic search and RAG feedback later.
 */

const lancedb = require('@lancedb/lancedb');
const { v4: uuidv4 } = require('uuid');
const { embedText } = require('./geminiService');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/lancedb');
const SESSIONS_TABLE = 'sessions';
const VECTOR_DIM = 768; // gemini-embedding-001 truncated to 768 dims

let _db = null;
let _table = null;

// ── Internal helpers ───────────────────────────────────────────────────────

async function getDb() {
  if (!_db) _db = await lancedb.connect(DB_PATH);
  return _db;
}

async function getTable() {
  if (_table) return _table;
  const db = await getDb();
  const names = await db.tableNames();

  if (names.includes(SESSIONS_TABLE)) {
    _table = await db.openTable(SESSIONS_TABLE);
  } else {
    // Bootstrap with a placeholder row so LanceDB knows the schema.
    // The placeholder is deleted immediately.
    const placeholder = _makeRow({
      id: '__init__',
      documentName: '',
      extractedText: '',
      interviewType: 'mixed',
      difficulty: 'mid',
      questions: [],
      vector: new Array(VECTOR_DIM).fill(0),
    });
    _table = await db.createTable(SESSIONS_TABLE, [placeholder]);
    await _table.delete(`id = '__init__'`);
  }

  return _table;
}

/** Serialize a session object into a flat LanceDB row. */
function _makeRow(session) {
  return {
    id:            session.id,
    documentName:  session.documentName  ?? '',
    extractedText: session.extractedText ?? '',
    interviewType: session.interviewType ?? 'mixed',
    difficulty:    session.difficulty    ?? 'mid',
    status:        session.status        ?? 'in_progress',
    questions:     JSON.stringify(session.questions  ?? []),
    answers:       JSON.stringify(session.answers    ?? []),
    feedback:      JSON.stringify(session.feedback   ?? null),
    score:         session.score         ?? 0,
    createdAt:     session.createdAt     ?? new Date().toISOString(),
    completedAt:   session.completedAt   ?? '',
    vector:        session.vector        ?? new Array(VECTOR_DIM).fill(0),
  };
}

/** Deserialize a LanceDB row back into the session object shape used by routes. */
function _parseRow(row) {
  if (!row) return null;
  return {
    id:            row.id,
    documentName:  row.documentName,
    extractedText: row.extractedText,
    interviewType: row.interviewType,
    difficulty:    row.difficulty,
    status:        row.status,
    questions:     JSON.parse(row.questions  || '[]'),
    answers:       JSON.parse(row.answers    || '[]'),
    feedback:      JSON.parse(row.feedback   || 'null'),
    score:         row.score,
    createdAt:     row.createdAt,
    completedAt:   row.completedAt || null,
    // vector is intentionally omitted — it's internal
  };
}

// ── Public API (same signatures as sessionStore.js) ────────────────────────

/**
 * Create a new interview session.
 * Embeds the document text in the background so vector search works later.
 */
async function createSession({ documentName, extractedText, questions, interviewType, difficulty }) {
  const table = await getTable();

  // Embed a trimmed version of the document (first 2000 chars keeps us inside
  // the embedding model's token limit while still capturing the gist).
  const snippet = (extractedText || '').slice(0, 2000);
  const vector = snippet ? await embedText(snippet) : new Array(VECTOR_DIM).fill(0);

  const session = {
    id:            uuidv4(),
    documentName:  documentName || 'Untitled Document',
    extractedText: extractedText || '',
    interviewType: interviewType || 'mixed',
    difficulty:    difficulty || 'mid',
    status:        'in_progress',
    questions:     questions,
    answers:       [],
    feedback:      null,
    score:         0,
    createdAt:     new Date().toISOString(),
    completedAt:   null,
    vector,
  };

  await table.add([_makeRow(session)]);
  return session;
}

/**
 * Read a single session by ID.
 * @param {string} id
 * @returns {object|null}
 */
async function read(id) {
  const table = await getTable();
  const rows = await table.query().where(`id = '${id}'`).limit(1).toArray();
  return rows.length ? _parseRow(rows[0]) : null;
}

/**
 * Save a single answer (replaces existing answer for the same questionId).
 */
async function saveAnswer(sessionId, questionId, transcript) {
  const session = await read(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const idx = session.answers.findIndex((a) => a.questionId === questionId);
  const entry = { questionId, transcript, recordedAt: new Date().toISOString() };
  if (idx >= 0) {
    session.answers[idx] = entry;
  } else {
    session.answers.push(entry);
  }

  const table = await getTable();
  await table.update({ where: `id = '${sessionId}'`, values: { answers: JSON.stringify(session.answers) } });
  return session;
}

/**
 * Attach feedback, set score, and mark session completed.
 */
async function completeSession(sessionId, feedback) {
  const session = await read(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const score = feedback?.overall ?? 0;
  const completedAt = new Date().toISOString();

  const table = await getTable();
  await table.update({
    where: `id = '${sessionId}'`,
    values: {
      status:      'completed',
      completedAt,
      feedback:    JSON.stringify(feedback),
      score,
    },
  });

  return { ...session, status: 'completed', completedAt, feedback, score };
}

/**
 * List all sessions, newest first, without extractedText.
 */
async function listSessions() {
  const table = await getTable();
  const rows = await table.query().toArray();

  return rows
    .map(_parseRow)
    .map(({ extractedText, ...rest }) => rest)   // strip large field
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── Vector-powered extras (new capabilities, not used by existing routes) ──

/**
 * Find sessions whose documents are semantically similar to a given text.
 * Used for RAG feedback — pass the current document text, get similar past sessions.
 * @param {string} text
 * @param {number} [limit=3]
 * @returns {Promise<object[]>}
 */
async function findSimilarSessions(text, limit = 3) {
  const table = await getTable();
  const queryVector = await embedText(text.slice(0, 2000));
  const rows = await table.vectorSearch(queryVector).limit(limit).toArray();
  return rows.map(_parseRow).map(({ extractedText, ...rest }) => rest);
}

module.exports = {
  createSession,
  read,
  saveAnswer,
  completeSession,
  listSessions,
  findSimilarSessions,   // new — use in feedback route for RAG
};
