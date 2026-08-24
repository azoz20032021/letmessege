/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/utils/seed.js',
  ],
  coverageThreshold: {
    // Set just under the current numbers, so a real regression fails CI.
    global: { statements: 72, branches: 48, functions: 65, lines: 75 },
  },
  verbose: true,
};
