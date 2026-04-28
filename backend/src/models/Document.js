const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName:  { type: String, required: true },
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    text:      { type: String, default: '' },
    status:    { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
