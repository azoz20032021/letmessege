'use strict';

/** Escapes user input so it can be embedded in a RegExp literal safely. */
const escapeRegExp = (input) => String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds a case-insensitive "contains" matcher from raw user input. */
const containsRegExp = (input) => new RegExp(escapeRegExp(input), 'i');

module.exports = { escapeRegExp, containsRegExp };
