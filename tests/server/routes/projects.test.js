import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leti-proj-'));
let cookies = '';
let projectId = '';
const username = 'projuser_' + Date.now();

beforeAll(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.SECRET_KEY = 'test-secret';
  const { createApp } = await import('../../../server/app.js');
  app = createApp();

  await request(app).post('/api/auth/register').send({ username, password: 'pass123' });
  const loginRes = await request(app).post('/api/auth/login').send({ username, password: 'pass123' });
  cookies = loginRes.headers['set-cookie']?.join('; ') || '';
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Projects API', () => {
  it('POST /api/projects creates a project', async () => {
    const res = await request(app).post('/api/projects').set('Cookie', cookies).send({ name: 'Test Project' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Project');
    projectId = res.body.id;
  });

  it('GET /api/projects lists projects', async () => {
    const res = await request(app).get('/api/projects').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.projects).toBeInstanceOf(Array);
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/projects/:id returns project details', async () => {
    const res = await request(app).get(`/api/projects/${projectId}`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Project');
    expect(res.body.files).toBeInstanceOf(Array);
  });

  it('PATCH /api/projects/:id updates project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', cookies)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('POST /api/projects/:id/clone clones a project', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/clone`).set('Cookie', cookies);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toContain('копия');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/projects/:id deletes a project', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`).set('Cookie', cookies);
    expect(res.status).toBe(200);
  });
});
