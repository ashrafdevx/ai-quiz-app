const express = require('express');
const fs = require('fs');
const router = express.Router();
const upload = require('../middleware/upload');
const { extractText } = require('../services/documentParser');
const Document = require('../models/Document');

/**
 * POST /api/documents/upload
 * Body: multipart/form-data, field name "document"
 */
router.post('/upload', upload.single('document'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "document".' });
  }

  let doc;
  try {
    const { path: filePath, mimetype, originalname } = req.file;

    doc = await Document.create({
      userId: req.userId,
      fileName: originalname,
      status: 'processing',
    });

    const text = await extractText(filePath, mimetype, originalname);

    fs.unlink(filePath, () => {});

    if (!text || text.trim().length < 20) {
      await Document.findByIdAndUpdate(doc._id, { status: 'failed' });
      return res.status(422).json({ error: 'Could not extract meaningful text from the file.' });
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
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.json({ document: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
