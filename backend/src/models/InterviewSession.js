const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  score:         { type: Number, min: 0, max: 100 },
  feedback:      { type: String },
  mistakes:      [{ type: String }],
  improvements:  [{ type: String }],
  improvedAnswer:{ type: String },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role:            { type: String, enum: ['ai', 'user', 'feedback'], required: true },
  content:         { type: String, default: '' },
  questionIndex:   { type: Number },   // which question this belongs to (0-based)
  inputMode:       { type: String, enum: ['text', 'voice'] },
  voiceTranscript: { type: String },   // raw transcript when inputMode = 'voice'
  evaluation:      { type: evaluationSchema },
  createdAt:       { type: Date, default: Date.now },
}, { _id: true });

const interviewSessionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  topic:         { type: String, required: true },
  category:      { type: String, default: 'general' },
  status:        { type: String, enum: ['active', 'completed'], default: 'active' },
  messages:      [messageSchema],
  questionCount: { type: Number, default: 0 },
  avgScore:      { type: Number, default: 0 },
  completedAt:   { type: Date },
}, { timestamps: true });

// Recompute avgScore from all feedback messages before save
interviewSessionSchema.methods.recalcAvgScore = function () {
  const feedbacks = this.messages.filter(m => m.role === 'feedback' && m.evaluation?.score != null);
  if (!feedbacks.length) { this.avgScore = 0; return; }
  const total = feedbacks.reduce((sum, m) => sum + m.evaluation.score, 0);
  this.avgScore = Math.round(total / feedbacks.length);
};

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
