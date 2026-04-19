const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { generateFromFile } = require('./geminiService');
const { extractionPrompt } = require('../prompts/templates');

/**
 * Extract plain text from a file based on its MIME type.
 * @param {string} filePath   - absolute path to the uploaded file
 * @param {string} mimeType   - MIME type string from multer
 * @param {string} originalName
 * @returns {Promise<string>} extracted text
 */
async function extractText(filePath, mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  // Plain text — read directly
  if (mimeType === 'text/plain' || ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  // DOCX — mammoth client-side extraction (no API quota used)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    if (!result.value || result.value.trim().length < 50) {
      throw new Error('Could not extract text from DOCX file.');
    }
    return result.value;
  }

  // PDF — send raw bytes to Gemini (handles complex layouts, multi-column, etc.)
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);

    // First try pdf-parse (fast, no API quota)
    try {
      const data = await pdfParse(buffer);
      const text = data.text && data.text.trim();
      if (text && text.length >= 100) {
        return text;
      }
    } catch {
      // Scanned/image PDF — fall through to Gemini
    }

    // Fallback: Gemini OCR for scanned/image-based PDFs
    const raw = await generateFromFile(extractionPrompt(), buffer, 'application/pdf');
    return raw;
  }

  throw new Error(
    `Unsupported file type: ${mimeType || ext}. Upload a PDF, DOCX, or TXT file.`
  );
}

module.exports = { extractText };
