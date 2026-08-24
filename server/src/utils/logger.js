'use strict';

const env = require('../config/env');

const COLORS = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';

const write = (level, args) => {
  if (env.isTest && level !== 'error') return;
  const stamp = new Date().toISOString();
  const tag = `${COLORS[level]}[${level.toUpperCase()}]${RESET}`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`${stamp} ${tag}`, ...args);
};

module.exports = {
  info: (...a) => write('info', a),
  warn: (...a) => write('warn', a),
  error: (...a) => write('error', a),
  debug: (...a) => env.isProd || write('debug', a),
};
