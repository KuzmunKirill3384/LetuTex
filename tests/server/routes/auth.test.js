import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leti-auth-'));

beforeAll(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.SECRET_KEY = 'test-secret';
  const { createApp } = await import('../../../server/app.js');
  app = createApp();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Auth API', () => {
  const username = 'testuser_' + Date.now();
  const password = 'testpass123';
  let cookies = '';

  it('POST /api/auth/register creates a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({ username, password, display_name: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(username);
  });

  it('POST /api/auth/register rejects duplicate username', async () => {
    const res = await request(app).post('/api/auth/register').send({ username, password });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login succeeds with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    cookies = res.headers['set-cookie']?.join('; ') || '';
    expect(cookies).toContain('user_id');
  });

  it('POST /api/auth/login fails with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns user when authenticated', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(username);
  });

  it('GET /api/auth/me returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout clears cookie', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookies);
    expect(res.status).toBe(200);
  });
});
