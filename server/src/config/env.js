'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const int = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: int(process.env.PORT, 5000),

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/letmessage',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_only_insecure_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Accepts a comma separated list so preview deployments can be whitelisted too.
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    get enabled() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },

  maxFileSizeBytes: int(process.env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,

  demo: {
    email: process.env.DEMO_EMAIL || 'demo@test.com',
    password: process.env.DEMO_PASSWORD || '123456',
  },

  trustProxy: bool(process.env.TRUST_PROXY, true),
};

if (env.isProd && env.jwt.secret.startsWith('dev_only')) {
  // Fail fast instead of silently signing tokens everybody can forge.
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

module.exports = env;
