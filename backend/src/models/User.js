const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    stats: {
      totalSessions: { type: Number, default: 0 },
      avgScore:       { type: Number, default: 0 },
      totalQuestions: { type: Number, default: 0 },
      totalAnswered:  { type: Number, default: 0 },
      streak:         { type: Number, default: 0 },
      bestScore:      { type: Number, default: 0 },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
