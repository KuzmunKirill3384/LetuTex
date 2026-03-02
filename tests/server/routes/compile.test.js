import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leti-compile-'));
let cookies = '';
let projectId = '';
const username = 'compileuser_' + Date.now();

beforeAll(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.SECRET_KEY = 'test-secret';
  const { createApp } = await import('../../../server/app.js');
  app = createApp();

  await request(app).post('/api/auth/register').send({ username, password: 'pass123' });
  const loginRes = await request(app).post('/api/auth/login').send({ username, password: 'pass123' });
  cookies = loginRes.headers['set-cookie']?.join('; ') || '';

  const projRes = await request(app).post('/api/projects').set('Cookie', cookies).send({ name: 'Compile Test' });
  projectId = projRes.body.id;

  await request(app)
    .put(`/api/projects/${projectId}/files/main.tex`)
    .set('Cookie', cookies)
    .send({ content: '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}' });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Compile API', () => {
  it('POST /compile returns structured response', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/compile`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('log');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('compile returns explicit pdf_url on success (if TeX available) or error on failure', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/compile`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    if (res.body.success) {
      expect(res.body.pdf_url).toMatch(/\/api\/projects\/.*\/output\.pdf/);
    } else {
      expect(res.body.pdf_url).toBeNull();
    }
  });

  it('GET /output.pdf returns 404 when PDF does not exist', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/output.pdf`).set('Cookie', cookies);
    if (res.status !== 200) {
      expect(res.status).toBe(404);
      expect(res.body.detail).toBeDefined();
    }
  });

  it('rejects compile without auth', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/compile`);
    expect(res.status).toBe(401);
  });
});
