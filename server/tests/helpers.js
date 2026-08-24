'use strict';

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { signAccessToken } = require('../src/utils/token');

let counter = 0;

/** Creates a user directly in the DB and returns it together with a token. */
async function makeUser(overrides = {}) {
  counter += 1;
  const user = await User.create({
    name: overrides.name || `Test User ${counter}`,
    email: overrides.email || `user${counter}@test.com`,
    password: overrides.password || 'password123',
    ...overrides,
  });
  return { user, token: signAccessToken(user._id), id: String(user._id) };
}

/** Supertest agent with the Authorization header pre-filled. */
const authed = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
  patch: (url) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

/** Creates a conversation of the given type between the actor and the others. */
async function makeConversation(token, { type = 'direct', memberIds, name } = {}) {
  const res = await authed(token)
    .post('/api/conversations')
    .send({ type, memberIds, ...(name ? { name } : {}) });
  return res.body.data.conversation;
}

module.exports = { makeUser, authed, makeConversation, request, app };
