const mongoose = require('mongoose');

const questItemSchema = new mongoose.Schema(
  {
    id:            { type: Number, required: true },
    question:      { type: String, required: true },
    correctAnswer: { type: String, required: true },
    tips:          [{ type: String }],
    topic:         { type: String, default: '' },
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    answered:      { type: Boolean, default: false },
    entryId:       { type: mongoose.Schema.Types.ObjectId, ref: 'DailyQuestEntry', default: null },
  },
  { _id: false }
);

const dailyQuestPlanSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:      { type: Date, required: true },   // UTC day-start
    questions: [questItemSchema],
  },
  { timestamps: true }
);

// One plan per user per day
dailyQuestPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyQuestPlan', dailyQuestPlanSchema);
