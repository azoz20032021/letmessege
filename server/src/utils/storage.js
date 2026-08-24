'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');
const logger = require('../utils/logger');

const LOCAL_DIR = path.resolve(__dirname, '../../uploads');

const isImage = (mimeType) => String(mimeType).startsWith('image/');

const uploadToCloudinary = (buffer, { folder, resourceType }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

async function saveLocally(file) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const ext = path.extname(file.originalname) || '';
  const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  await fs.writeFile(path.join(LOCAL_DIR, key), file.buffer);
  return { url: `/uploads/${key}`, publicId: `local:${key}` };
}

/**
 * Stores an in-memory multer file and returns an attachment descriptor.
 * Uses Cloudinary when configured, otherwise falls back to local disk so the
 * project still runs end-to-end with zero third-party credentials.
 */
async function storeFile(file, { folder = 'letmessage' } = {}) {
  let stored;

  if (env.cloudinary.enabled) {
    const result = await uploadToCloudinary(file.buffer, {
      folder,
      resourceType: isImage(file.mimetype) ? 'image' : 'auto',
    });
    stored = {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    };
  } else {
    logger.debug('Cloudinary not configured — storing upload on local disk');
    stored = await saveLocally(file);
  }

  return {
    ...stored,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

async function deleteFile(publicId) {
  if (!publicId) return;
  if (publicId.startsWith('local:')) {
    await fs.rm(path.join(LOCAL_DIR, publicId.slice(6)), { force: true });
    return;
  }
  if (env.cloudinary.enabled) await cloudinary.uploader.destroy(publicId);
}

module.exports = { storeFile, deleteFile, isImage, LOCAL_DIR };
