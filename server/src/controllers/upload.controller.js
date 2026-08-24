'use strict';

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { storeFile } = require('../utils/storage');

/**
 * POST /api/uploads
 *
 * Stores files and returns attachment descriptors. The client uploads first and
 * then emits the message over the socket, which keeps the realtime path free of
 * multipart payloads.
 */
const uploadFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files uploaded', { code: 'NO_FILES' });
  }

  const attachments = await Promise.all(
    req.files.map((file) => storeFile(file, { folder: 'letmessage/messages' }))
  );

  res.status(201).json({ success: true, data: { attachments } });
});

module.exports = { uploadFiles };
