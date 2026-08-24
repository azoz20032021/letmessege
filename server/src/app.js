'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const routes = require('./routes');
const ApiError = require('./utils/ApiError');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

if (env.trustProxy) app.set('trust proxy', 1);

app.use(
  helmet({
    // Uploads are served cross-origin to the Vercel front-end.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

const corsOptions = {
  origin(origin, callback) {
    // Same-origin / curl / mobile webviews send no Origin header.
    if (!origin) return callback(null, true);
    if (env.clientUrls.includes(origin)) return callback(null, true);
    // Allow Vercel preview deployments of this project.
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);

    // A disallowed origin is a rejected request, not a server fault — answering
    // 500 would both mislead the caller and fill the logs with fake incidents.
    return callback(
      ApiError.forbidden(`Origin ${origin} is not allowed by CORS`, { code: 'CORS_BLOCKED' })
    );
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Local-disk upload fallback (used when Cloudinary is not configured).
app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../uploads'), { maxAge: '7d', fallthrough: true })
);

app.get('/', (_req, res) =>
  res.json({
    success: true,
    data: {
      name: 'LetMessage API',
      version: require('../package.json').version,
      docs: '/api/health',
    },
  })
);

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
