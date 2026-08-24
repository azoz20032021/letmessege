'use strict';

const multer = require('multer');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) =>
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`, { code: 'NO_ROUTE' }));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let error = err;

  if (err instanceof multer.MulterError) {
    error =
      err.code === 'LIMIT_FILE_SIZE'
        ? ApiError.tooLarge('File is larger than the allowed limit', { code: 'FILE_TOO_LARGE' })
        : ApiError.badRequest(err.message, { code: err.code });
  } else if (err.name === 'ValidationError') {
    error = ApiError.badRequest('Validation failed', {
      code: 'VALIDATION_ERROR',
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  } else if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}`, { code: 'INVALID_ID' });
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || { field: '' })[0];
    error = ApiError.conflict(`This ${field} is already registered`, { code: 'DUPLICATE' });
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(err.message || 'Something went wrong');
    error.isOperational = false;
  }

  if (!error.isOperational || error.statusCode >= 500) logger.error(err.stack || err.message);

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
