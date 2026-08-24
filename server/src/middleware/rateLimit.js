'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  // Rate limiting would make the test-suite flaky and adds nothing there.
  skip: () => env.isTest,
  message: { success: false, message: 'Too many requests, please slow down', code: 'RATE_LIMITED' },
};

const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 600 });

const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: {
    success: false,
    message: 'Too many authentication attempts, try again in 15 minutes',
    code: 'RATE_LIMITED',
  },
});

const uploadLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 30 });

module.exports = { apiLimiter, authLimiter, uploadLimiter };
