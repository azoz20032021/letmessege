'use strict';

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const env = require('../src/config/env');
const { makeUser, authed } = require('./helpers');

describe('POST /api/auth/register', () => {
  it('creates an account and returns an access token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('ada@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('hashes the password instead of storing it in clear text', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Grace Hopper', email: 'grace@test.com', password: 'password123' });

    const stored = await User.findOne({ email: 'grace@test.com' }).select('+password');
    expect(stored.password).not.toBe('password123');
    expect(await stored.comparePassword('password123')).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    await makeUser({ email: 'dup@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone', email: 'dup@test.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects an invalid payload with field level details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials', async () => {
    await makeUser({ email: 'login@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
  });

  it('sets an httpOnly refresh cookie', async () => {
    await makeUser({ email: 'cookie@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cookie@test.com', password: 'password123' });

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await makeUser({ email: 'known@test.com', password: 'password123' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@test.com', password: 'nope-nope' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'password123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe('POST /api/auth/demo', () => {
  it('signs in the seeded reviewer account', async () => {
    await makeUser({ email: env.demo.email, password: env.demo.password, isDemo: true });

    const res = await request(app).post('/api/auth/demo');

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(env.demo.email);
  });

  it('explains what to do when the demo account is missing', async () => {
    const res = await request(app).post('/api/auth/demo');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_DEMO');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { token, user } = await makeUser();

    const res = await authed(token).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(String(user._id));
  });

  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('rejects a malformed token', async () => {
    const res = await authed('not.a.jwt').get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});
