const mongoose = require('mongoose');

const dailyQuestEntrySchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId:        { type: mongoose.Schema.Types.ObjectId, ref: 'DailyQuestPlan', required: true },
    date:          { type: Date, required: true },   // UTC day-start — used for grouping
    questionId:    { type: Number, required: true },
    question:      { type: String, required: true },
    userAnswer:    { type: String, default: '' },
    correctAnswer: { type: String, required: true },
    tips:          [{ type: String }],
    topic:         { type: String, default: '' },
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    isCorrect:     { type: Boolean, default: false },
    score:         { type: Number, min: 0, max: 100, default: 0 },
    feedback:      { type: String, default: '' },
    completedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Primary retrieval pattern: user's history newest-first
dailyQuestEntrySchema.index({ userId: 1, date: -1 });
// Idempotency: one entry per question per plan per user
dailyQuestEntrySchema.index({ userId: 1, planId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('DailyQuestEntry', dailyQuestEntrySchema);
