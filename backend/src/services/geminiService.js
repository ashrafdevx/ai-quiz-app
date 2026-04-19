const { GoogleGenerativeAI } = require('@google/generative-ai');

let _client = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
  }
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _client;
}

/**
 * Send a plain text prompt and get a text response.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function generateText(prompt) {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Send a prompt alongside a raw file buffer (e.g. a PDF) and get a text response.
 * Gemini natively understands PDFs, DOCX, images, etc.
 * @param {string} prompt
 * @param {Buffer} fileBuffer
 * @param {string} mimeType  e.g. 'application/pdf'
 * @returns {Promise<string>}
 */
async function generateFromFile(prompt, fileBuffer, mimeType) {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const filePart = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([filePart, prompt]);
  return result.response.text();
}

/**
 * Parse a JSON response from Gemini, stripping any markdown fences if present.
 * @param {string} raw
 * @returns {object}
 */
function parseJsonResponse(raw) {
  // Strip ```json ... ``` or ``` ... ``` if Gemini wraps it anyway
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Gemini returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Generate a 768-dimensional embedding for a text string.
 * Uses Gemini text-embedding-004 (free tier, 1500 req/min).
 * @param {string} text
 * @returns {Promise<number[]>}  float32[768]
 */
async function embedText(text) {
  const model = getClient().getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    outputDimensionality: 768,
  });
  return result.embedding.values;
}

module.exports = { generateText, generateFromFile, parseJsonResponse, embedText };
