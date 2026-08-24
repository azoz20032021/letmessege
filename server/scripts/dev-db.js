'use strict';

/**
 * Throwaway MongoDB for local development.
 *
 *   npm run dev:db
 *
 * Starts an in-memory mongod on 127.0.0.1:27017 and keeps it running until you
 * stop it. Handy when you want to try the app without installing MongoDB or
 * signing up for Atlas — the data disappears when the process exits, so re-run
 * `npm run seed` after each restart.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.DEV_DB_PORT ?? 27017);

async function main() {
  const mongod = await MongoMemoryServer.create({
    instance: { port: PORT, ip: '127.0.0.1', dbName: 'letmessage' },
  });

  const uri = mongod.getUri();
  process.stdout.write(
    [
      '',
      '  Dev MongoDB is running (in memory — data is lost on exit)',
      `  URI: ${uri}`,
      '',
      '  Next, in another terminal:',
      '    npm run seed --workspace server',
      '    npm run dev',
      '',
      '  Press Ctrl+C to stop.',
      '',
    ].join('\n')
  );

  const stop = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  process.stderr.write(`Failed to start the dev database: ${err.message}\n`);
  process.exit(1);
});
