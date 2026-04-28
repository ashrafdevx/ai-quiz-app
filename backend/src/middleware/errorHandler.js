// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // Multer: file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    console.error(`[ERROR] 413 ${req.method} ${req.path} — File too large`);
    return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
  }

  // Validation / known client errors (4xx) — no stack trace needed
  if (status < 500) {
    console.warn(`[WARN]  ${status} ${req.method} ${req.path} — ${err.message}`);
  } else {
    // Server errors — log full stack
    console.error(`[ERROR] ${status} ${req.method} ${req.path} — ${err.message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
  });
}

module.exports = errorHandler;
