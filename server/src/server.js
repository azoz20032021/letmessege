'use strict';

const http = require('http');

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');
const { initSocket } = require('./socket');

const server = http.createServer(app);

async function bootstrap() {
  await connectDB();
  initSocket(server);

  server.listen(env.port, () => {
    logger.info(`LetMessage API listening on :${env.port} [${env.nodeEnv}]`);
    logger.info(`Allowed origins: ${env.clientUrls.join(', ')}`);
    logger.info(`Uploads: ${env.cloudinary.enabled ? 'Cloudinary' : 'local disk (./uploads)'}`);
  });
}

const shutdown = (signal) => async () => {
  logger.warn(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});
