'use strict';

const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
  'video/mp4', 'video/webm',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes, files: 5 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`, {
        code: 'UNSUPPORTED_TYPE',
      }));
    }
    return cb(null, true);
  },
});

module.exports = { upload, ALLOWED_MIME };
