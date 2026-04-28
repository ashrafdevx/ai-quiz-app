const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');

const authRouter        = require('./routes/auth');
const documentsRouter   = require('./routes/documents');
const questionsRouter   = require('./routes/questions');
const sessionsRouter    = require('./routes/sessions');
const feedbackRouter    = require('./routes/feedback');
const voiceAnswerRouter = require('./routes/voiceAnswer');
const authMiddleware  = require('./middleware/authMiddleware');
const errorHandler    = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (non-blocking — server starts even if DB is slow)
connectDB().catch(err => console.error('MongoDB connection error:', err));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Public routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/documents',     authMiddleware, documentsRouter);
app.use('/api/questions',     authMiddleware, questionsRouter);
app.use('/api/sessions',      authMiddleware, sessionsRouter);
app.use('/api/sessions',      authMiddleware, voiceAnswerRouter);
app.use('/api/feedback',      authMiddleware, feedbackRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

module.exports = app;
