// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // Multer: file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    console.error(`[ERROR] 413 ${req.method} ${req.path} — File too large`);
    return res.status(413).json({
      success: false,
      message: 'File is too large. Maximum size is 10 MB.',
      code: 'FILE_TOO_LARGE',
    });
  }

  // Log full detail on server — never send raw details to client
  if (status < 500) {
    console.warn(`[WARN]  ${status} ${req.method} ${req.path} — ${err.message}`);
  } else {
    console.error(`[ERROR] ${status} ${req.method} ${req.path} — ${err.message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    message: friendlyMessage(status, err.message),
    code:    errorCode(status),
  });
}

function friendlyMessage(status, raw) {
  switch (status) {
    case 400: return raw || 'Invalid request.';
    case 401: return 'You are not logged in. Please sign in and try again.';
    case 403: return 'You do not have permission to do that.';
    case 404: return raw || 'Resource not found.';
    case 409: return raw || 'This resource already exists.';
    case 413: return 'File is too large. Maximum size is 10 MB.';
    case 422: return raw || 'Could not process the file.';
    case 429: return 'Server is busy. Please try again shortly.';
    case 503: return raw || 'AI service is temporarily unavailable. Please try again later.';
    default:  return status < 500
      ? (raw || 'Request failed.')
      : 'Something went wrong. Please try again.';
  }
}

function errorCode(status) {
  const map = {
    400: 'INVALID_INPUT',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'FILE_TOO_LARGE',
    422: 'UNPROCESSABLE',
    429: 'RATE_LIMITED',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] ?? (status < 500 ? 'CLIENT_ERROR' : 'SERVER_ERROR');
}

module.exports = errorHandler;
