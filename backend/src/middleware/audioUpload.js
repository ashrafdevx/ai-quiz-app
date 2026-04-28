const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const AUDIO_DIR = path.join(__dirname, '../../uploads/audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Groq Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
const ALLOWED_AUDIO_TYPES = [
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'video/mp4', // iOS sometimes sends m4a with this MIME type
];

const storage = multer.diskStorage({
  destination: AUDIO_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.m4a';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${file.mimetype}. Use m4a, wav, mp3, or webm.`), false);
  }
};

const audioUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // Groq Whisper max is 25 MB
});

module.exports = audioUpload;
