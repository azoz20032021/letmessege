'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId), typ: 'access' }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const signRefreshToken = (userId) =>
  jwt.sign({ sub: String(userId), typ: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.secret);
const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

/** Reads the bearer token from the Authorization header, falling back to the cookie. */
const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  return null;
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractToken,
};
