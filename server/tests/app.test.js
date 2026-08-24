'use strict';

const request = require('supertest');
const app = require('../src/app');

const preflight = (origin) =>
  request(app)
    .options('/api/auth/demo')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST');

describe('CORS', () => {
  it('allows the configured client origin', async () => {
    const res = await preflight('http://localhost:5173');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows Vercel deployments so preview URLs work without reconfiguring', async () => {
    const res = await preflight('https://letmessage-git-main-someone.vercel.app');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://letmessage-git-main-someone.vercel.app'
    );
  });

  it('rejects an unknown origin with 403, not 500', async () => {
    const res = await preflight('https://not-my-site.example.com');

    // A blocked origin is a rejected request, not a server fault: answering 500
    // would misreport it to the caller and log a phantom incident.
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CORS_BLOCKED');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows a request that carries no Origin header at all', async () => {
    // curl, server-to-server calls and some mobile webviews send none.
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
  });

  it('does not let a lookalike domain through the Vercel rule', async () => {
    const res = await preflight('https://vercel.app.attacker.com');

    expect(res.status).toBe(403);
  });
});

describe('service endpoints', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.uptime).toEqual(expect.any(Number));
  });

  it('answers 404 in the standard error shape for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NO_ROUTE' });
  });
});
