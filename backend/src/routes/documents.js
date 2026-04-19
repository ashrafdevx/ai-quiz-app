const express = require('express');
const fs = require('fs');
const router = express.Router();
const upload = require('../middleware/upload');
const { extractText } = require('../services/documentParser');

/**
 * POST /api/documents/upload
 * Body: multipart/form-data, field name "document"
 * Response: { text, wordCount, charCount, fileName }
 */
router.post('/upload', upload.single('document'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "document".' });
  }

  try {
    const { path: filePath, mimetype, originalname } = req.file;

    const text = await extractText(filePath, mimetype, originalname);

    // Clean up temp file after extraction
    fs.unlink(filePath, () => {});

    if (!text || text.trim().length < 20) {
      return res.status(422).json({ error: 'Could not extract meaningful text from the file.' });
    }

    res.json({
      fileName: originalname,
      text: text.trim(),
      wordCount: text.trim().split(/\s+/).length,
      charCount: text.trim().length,
    });
  } catch (err) {
    // Clean up temp file on error too
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
});

module.exports = router;
