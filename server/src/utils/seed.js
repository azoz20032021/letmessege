'use strict';

/**
 * Seeds the database with the reviewer demo account plus a handful of
 * conversations so the app never opens on an empty screen.
 *
 *   npm run seed            # keeps existing data, upserts the demo set
 *   npm run seed -- --fresh # wipes users/conversations/messages first
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('./logger');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const PEOPLE = [
  { name: 'Layla Haddad', email: 'layla@test.com', bio: 'Product designer · Amman', locale: 'ar' },
  { name: 'Emre Yilmaz', email: 'emre@test.com', bio: 'Backend engineer · Istanbul', locale: 'tr' },
  { name: 'Sofia Rossi', email: 'sofia@test.com', bio: 'QA lead · Milan', locale: 'en' },
  { name: 'Omar Nasser', email: 'omar@test.com', bio: 'DevOps · Dubai', locale: 'ar' },
];

const DIRECT_SCRIPTS = {
  'layla@test.com': [
    ['them', 'Hey! Did you get a chance to look at the new chat mockups?'],
    ['me', 'Just opened them — the message bubbles look great 👌'],
    ['them', 'Thanks! I moved the typing indicator under the header.'],
    ['me', 'Much better. Ship it.'],
  ],
  'emre@test.com': [
    ['them', 'Merhaba! The socket reconnect logic is deployed to staging.'],
    ['me', 'Nice. Did you test it with the network throttled?'],
    ['them', 'Yes — it reconnects in about 1.2s and replays the queue.'],
  ],
  'sofia@test.com': [
    ['them', 'Found an edge case: unread badge stays after opening a group.'],
    ['me', 'Good catch, I will mark the room as read on join.'],
    ['them', 'Perfect, I will re-run the suite tomorrow.'],
  ],
};

const GROUP_SCRIPT = [
  ['layla@test.com', 'Morning everyone ☀️'],
  ['emre@test.com', 'Morning! Standup in 10?'],
  ['me', 'Works for me. I will share the realtime metrics.'],
  ['sofia@test.com', 'I have three bugs to walk through.'],
  ['omar@test.com', 'Deploy window is 4pm today, keep main green please.'],
];

async function upsertUser({ name, email, password, bio = '', locale = 'en', isDemo = false }) {
  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = name;
    existing.bio = bio;
    existing.locale = locale;
    existing.isDemo = isDemo;
    existing.password = password; // re-hashed by the pre-save hook
    await existing.save();
    return existing;
  }
  return User.create({ name, email, password, bio, locale, isDemo });
}

/** Rewrites a conversation's history from a script, oldest message first. */
async function writeScript(conversation, script, resolveSender, startMinutesAgo) {
  await Message.deleteMany({ conversation: conversation._id });

  let last = null;
  for (let i = 0; i < script.length; i += 1) {
    const [who, text] = script[i];
    const createdAt = new Date(Date.now() - (startMinutesAgo - i * 3) * 60 * 1000);
    // eslint-disable-next-line no-await-in-loop
    last = await Message.create({
      conversation: conversation._id,
      sender: resolveSender(who),
      text,
      type: 'text',
      createdAt,
      updatedAt: createdAt,
    });
  }

  conversation.lastMessage = last?._id || null;
  conversation.lastMessageAt = last?.createdAt || new Date();
  await conversation.save();
  return last;
}

async function seed() {
  const fresh = process.argv.includes('--fresh');
  await connectDB();

  if (fresh) {
    logger.warn('--fresh: dropping users, conversations and messages');
    await Promise.all([
      User.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
    ]);
  }

  const demo = await upsertUser({
    name: 'Demo User',
    email: env.demo.email,
    password: env.demo.password,
    bio: 'Reviewer demo account — explore everything freely.',
    locale: 'en',
    isDemo: true,
  });

  const people = [];
  for (const person of PEOPLE) {
    // eslint-disable-next-line no-await-in-loop
    people.push(await upsertUser({ ...person, password: 'password123' }));
  }
  const byEmail = Object.fromEntries(people.map((p) => [p.email, p]));

  // 1-to-1 conversations
  let minutesAgo = 180;
  for (const [email, script] of Object.entries(DIRECT_SCRIPTS)) {
    const peer = byEmail[email];
    // eslint-disable-next-line no-await-in-loop
    const conversation = await Conversation.findOrCreateDirect(demo._id, peer._id);
    // eslint-disable-next-line no-await-in-loop
    await writeScript(
      conversation,
      script,
      (who) => (who === 'me' ? demo._id : peer._id),
      minutesAgo
    );
    minutesAgo -= 40;
  }

  // Group conversation
  let group = await Conversation.findOne({ type: 'group', name: 'Product Team' });
  if (!group) {
    group = await Conversation.create({
      type: 'group',
      name: 'Product Team',
      description: 'Daily standup, releases and random memes',
      members: [demo._id, ...people.map((p) => p._id)],
      admins: [demo._id],
      createdBy: demo._id,
    });
  } else {
    group.members = [demo._id, ...people.map((p) => p._id)];
    group.admins = [demo._id];
    await group.save();
  }
  await writeScript(group, GROUP_SCRIPT, (who) => (who === 'me' ? demo._id : byEmail[who]._id), 25);

  // Leave a couple of unread messages waiting for the reviewer.
  group.readState.set(String(demo._id), new Date(Date.now() - 60 * 60 * 1000));
  await group.save();

  logger.info('─'.repeat(56));
  logger.info('Seed complete');
  logger.info(`  Demo login : ${env.demo.email} / ${env.demo.password}`);
  logger.info(`  Teammates  : ${PEOPLE.map((p) => p.email).join(', ')} (password123)`);
  logger.info(`  Data       : ${await Conversation.countDocuments()} conversations, ${await Message.countDocuments()} messages`);
  logger.info('─'.repeat(56));

  await disconnectDB();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error('Seed failed:', err);
      await mongoose.connection.close().catch(() => {});
      process.exit(1);
    });
}

module.exports = seed;
