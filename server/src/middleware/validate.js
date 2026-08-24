'use strict';

const ApiError = require('../utils/ApiError');

/** Validates `req[source]` against a zod schema and replaces it with the parsed value. */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(
      ApiError.badRequest('Validation failed', {
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
    );
  }
  if (source === 'query') Object.assign(req.query, result.data);
  else req[source] = result.data;
  return next();
};

module.exports = validate;
