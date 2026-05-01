const express = require('express');
const fs = require('fs');
const router = express.Router();
const upload = require('../middleware/upload');
const audioUpload = require('../middleware/audioUpload');
const { extractText } = require('../services/documentParser');
const { transcribeAudio } = require('../services/geminiService');
const Document = require('../models/Document');

/**
 * POST /api/documents/upload
 * Body: multipart/form-data, field name "document"
 */
router.post('/upload', upload.single('document'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file received. Please select a file and try again.',
      code: 'INVALID_INPUT',
    });
  }

  let doc;
  try {
    const { path: filePath, mimetype, originalname } = req.file;
    const fileName = (() => { try { return decodeURIComponent(originalname); } catch { return originalname; } })();

    doc = await Document.create({
      userId: req.userId,
      fileName,
      status: 'processing',
    });

    const text = await extractText(filePath, mimetype, originalname);

    fs.unlink(filePath, () => {});

    if (!text || text.trim().length < 20) {
      await Document.findByIdAndUpdate(doc._id, { status: 'failed' });
      return res.status(422).json({
        success: false,
        message: 'Could not extract text from this file. Try a different file.',
        code: 'UNPROCESSABLE',
      });
    }

    const trimmed = text.trim();
    doc = await Document.findByIdAndUpdate(
      doc._id,
      {
        text: trimmed,
        wordCount: trimmed.split(/\s+/).length,
        charCount: trimmed.length,
        status: 'ready',
      },
      { new: true }
    );

    res.json({
      documentId: doc._id,
      fileName: doc.fileName,
      wordCount: doc.wordCount,
      charCount: doc.charCount,
      status: doc.status,
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (doc) await Document.findByIdAndUpdate(doc._id, { status: 'failed' }).catch(() => {});
    next(err);
  }
});

/**
 * GET /api/documents
 * Returns all documents for the current user (newest first, no text body)
 */
router.get('/', async (req, res, next) => {
  try {
    const documents = await Document.find({ userId: req.userId })
      .select('-text')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ documents });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:id
 * Returns a single document including full text (for question generation)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
        code: 'NOT_FOUND',
      });
    }
    res.json({ document: doc });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/transcribe
 * Accepts an audio file, transcribes it via Groq Whisper, returns raw transcript.
 */
router.post('/transcribe', audioUpload.single('audio'), async (req, res, next) => {
  const audioPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file received.', code: 'MISSING_AUDIO' });
    }
    const transcript = await transcribeAudio(audioPath);
    res.json({ transcript });
  } catch (err) {
    next(err);
  } finally {
    if (audioPath) fs.unlink(audioPath, () => {});
  }
});

/**
 * POST /api/documents/from-text
 * Saves a plain-text string as a Document (e.g. from a voice recording transcript).
 * Body: { text: string, name?: string }
 */
router.post('/from-text', async (req, res, next) => {
  try {
    const { text, name } = req.body;
    const trimmed = (text ?? '').trim();
    if (trimmed.length < 20) {
      return res.status(400).json({ success: false, message: 'Text is too short to generate questions from.', code: 'INVALID_INPUT' });
    }
    const fileName = name?.trim() || `Voice note ${new Date().toLocaleDateString('en-US')}`;
    const doc = await Document.create({
      userId:    req.userId,
      fileName,
      text:      trimmed,
      wordCount: trimmed.split(/\s+/).length,
      charCount: trimmed.length,
      status:    'ready',
    });
    res.json({ documentId: doc._id, fileName: doc.fileName, wordCount: doc.wordCount, charCount: doc.charCount, status: doc.status });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/documents/:id
 * Deletes a document record. Sessions using this document are unaffected
 * because they store a copy of the extracted text at creation time.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.', code: 'NOT_FOUND' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
