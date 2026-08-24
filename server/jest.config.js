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
    global: { statements: 50, branches: 35, functions: 50, lines: 50 },
  },
  verbose: true,
};
