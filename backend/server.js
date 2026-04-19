require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🎙️  English Practice API running on http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/documents/upload       — upload PDF/DOCX/TXT, get extracted text`);
  console.log(`  POST /api/questions/generate     — generate interview questions from text`);
  console.log(`  POST /api/sessions               — create a new interview session`);
  console.log(`  GET  /api/sessions               — list all sessions`);
  console.log(`  GET  /api/sessions/:id           — get a single session`);
  console.log(`  PUT  /api/sessions/:id/answer    — save an answer to a question`);
  console.log(`  POST /api/sessions/:id/complete  — mark session complete`);
  console.log(`  POST /api/feedback/:sessionId    — generate AI feedback + score`);
  console.log(`  GET  /api/health                 — health check\n`);
});
