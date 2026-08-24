'use strict';

const mongoose = require('mongoose');

let mongod;

/**
 * Tests need a MongoDB to talk to.
 *
 * By default we spin up an ephemeral in-memory server, which is what CI uses.
 * Set MONGODB_TEST_URI to point the suite at a real instance instead — handy on
 * machines where the bundled mongod binary cannot run (for example a Windows
 * box without the Visual C++ runtime).
 */
async function resolveUri() {
  if (process.env.MONGODB_TEST_URI) return process.env.MONGODB_TEST_URI;

  // eslint-disable-next-line global-require
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();
  return mongod.getUri();
}

beforeAll(async () => {
  const uri = await resolveUri();
  await mongoose.connect(uri, { dbName: 'letmessage-test' });
});

afterEach(async () => {
  // Keep every test independent without paying for a fresh server each time.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
});
