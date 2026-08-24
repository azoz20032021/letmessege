'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { storeFile, deleteFile } = require('../utils/storage');
const { getOnlineUserIds } = require('../socket/presence');
const { containsRegExp } = require('../utils/escapeRegExp');

// GET /api/users?q=
const listUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 30, 50);

  const filter = { _id: { $ne: req.user._id } };
  if (q) {
    const rx = containsRegExp(q);
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const users = await User.find(filter)
    .select(User.PUBLIC_FIELDS)
    .sort({ isOnline: -1, name: 1 })
    .limit(limit)
    .lean();

  res.json({ success: true, data: { users, count: users.length } });
});

// GET /api/users/online
const onlineUsers = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { userIds: getOnlineUserIds() } });
});

// GET /api/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(User.PUBLIC_FIELDS).lean();
  if (!user) throw ApiError.notFound('User not found', { code: 'NO_USER' });
  res.json({ success: true, data: { user } });
});

// PATCH /api/users/me
const updateProfile = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ success: true, data: { user: req.user.toPublic() } });
});

// POST /api/users/me/avatar
const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded', { code: 'NO_FILE' });
  if (!req.file.mimetype.startsWith('image/')) {
    throw ApiError.badRequest('Avatar must be an image', { code: 'NOT_IMAGE' });
  }

  const stored = await storeFile(req.file, { folder: 'letmessage/avatars' });
  const previous = req.user.avatarPublicId;

  req.user.avatar = stored.url;
  req.user.avatarPublicId = stored.publicId;
  await req.user.save();

  if (previous) await deleteFile(previous).catch(() => {});

  res.json({ success: true, data: { user: req.user.toPublic() } });
});

module.exports = { listUsers, onlineUsers, getUser, updateProfile, updateAvatar };
