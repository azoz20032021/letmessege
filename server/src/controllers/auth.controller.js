'use strict';

const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/token');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const issue = (res, user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
  return { accessToken, refreshToken, user: user.toPublic() };
};

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, locale } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('This email is already registered', { code: 'EMAIL_TAKEN' });
  }

  const user = await User.create({ name, email, password, locale: locale || 'en' });
  res.status(201).json({ success: true, data: issue(res, user) });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  // Same message for both branches so the endpoint cannot be used to enumerate accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password', { code: 'BAD_CREDENTIALS' });
  }

  res.json({ success: true, data: issue(res, user) });
});

// POST /api/auth/demo — one-click sign in for reviewers.
const demoLogin = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: env.demo.email });
  if (!user) {
    throw ApiError.notFound('Demo account is not seeded yet — run `npm run seed`', {
      code: 'NO_DEMO',
    });
  }
  res.json({ success: true, data: issue(res, user) });
});

// POST /api/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token', { code: 'NO_REFRESH' });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Refresh token expired', { code: 'REFRESH_EXPIRED' });
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists', { code: 'USER_GONE' });

  res.json({ success: true, data: issue(res, user) });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { isOnline: false, lastSeen: new Date() });
  res.clearCookie('refreshToken', { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ success: true, message: 'Signed out' });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toPublic() } });
});

module.exports = { register, login, demoLogin, refresh, logout, me };
