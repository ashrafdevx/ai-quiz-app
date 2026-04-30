const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { generateText } = require('./geminiService');

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

  // PDF — pdf-parse first, Groq cleanup as fallback for messy/short extracts
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);

    let rawText = '';
    try {
      const data = await pdfParse(buffer);
      rawText = (data.text || '').trim();
    } catch {
      // pdf-parse failed (corrupted or fully image-based PDF)
    }

    // Clean text — return as-is
    if (rawText.length >= 100) return rawText;

    // Short/messy extract — ask Groq to clean it up
    if (rawText.length >= 20) {
      try {
        const cleaned = await generateText(
          `Clean up this raw PDF text extract. Remove headers, footers, page numbers, and formatting artifacts. Keep all meaningful body content. Return only the clean text, no explanation.\n\n${rawText.slice(0, 8000)}`
        );
        const cleanedText = (cleaned || '').trim();
        return cleanedText.length >= 20 ? cleanedText : rawText;
      } catch {
        return rawText; // Groq failed — use raw pdf-parse output
      }
    }

    // Nothing extractable — almost certainly a scanned/image PDF
    throw Object.assign(
      new Error('This PDF appears to be image-based or scanned. Please upload a text-based PDF, or export your document as DOCX or TXT first.'),
      { status: 422 }
    );
  }

  throw new Error(
    `Unsupported file type: ${mimeType || ext}. Upload a PDF, DOCX, or TXT file.`
  );
}

module.exports = { extractText };
