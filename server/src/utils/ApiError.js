'use strict';

/** Operational error carrying an HTTP status code and an optional i18n key. */
class ApiError extends Error {
  constructor(statusCode, message, { code = undefined, details = undefined } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', opts) { return new ApiError(400, msg, opts); }
  static unauthorized(msg = 'Unauthorized', opts) { return new ApiError(401, msg, opts); }
  static forbidden(msg = 'Forbidden', opts) { return new ApiError(403, msg, opts); }
  static notFound(msg = 'Not found', opts) { return new ApiError(404, msg, opts); }
  static conflict(msg = 'Conflict', opts) { return new ApiError(409, msg, opts); }
  static tooLarge(msg = 'Payload too large', opts) { return new ApiError(413, msg, opts); }
  static internal(msg = 'Internal server error', opts) { return new ApiError(500, msg, opts); }
}

module.exports = ApiError;
