'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken, extractToken } = require('../utils/token');

const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required', { code: 'NO_TOKEN' });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    throw ApiError.unauthorized('Session expired, please sign in again', { code });
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists', { code: 'USER_GONE' });

  req.user = user;
  return next();
});

/** Blocks writes that would let anyone tamper with the shared demo account. */
const blockDemoMutation = (req, _res, next) => {
  if (req.user && req.user.isDemo) {
    return next(
      ApiError.forbidden('The demo account is read-only for this action', { code: 'DEMO_READONLY' })
    );
  }
  return next();
};

module.exports = { protect, blockDemoMutation };
