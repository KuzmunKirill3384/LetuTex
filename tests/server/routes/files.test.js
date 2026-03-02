import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leti-files-'));
let cookies = '';
let projectId = '';
const username = 'fileuser_' + Date.now();

beforeAll(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.SECRET_KEY = 'test-secret';
  const { createApp } = await import('../../../server/app.js');
  app = createApp();

  await request(app).post('/api/auth/register').send({ username, password: 'pass123' });
  const loginRes = await request(app).post('/api/auth/login').send({ username, password: 'pass123' });
  cookies = loginRes.headers['set-cookie']?.join('; ') || '';

  const projRes = await request(app).post('/api/projects').set('Cookie', cookies).send({ name: 'File Test' });
  projectId = projRes.body.id;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Files API', () => {
  it('POST creates a file', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', cookies)
      .send({ path: 'test.tex', content: '\\documentclass{article}' });
    expect(res.status).toBe(201);
  });

  it('GET reads file content', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files/test.tex`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.content).toContain('\\documentclass');
  });

  it('PUT updates file content', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/files/test.tex`)
      .set('Cookie', cookies)
      .send({ content: '\\documentclass{report}' });
    expect(res.status).toBe(200);
  });

  it('POST creates a folder', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/folders`)
      .set('Cookie', cookies)
      .send({ path: 'sections' });
    expect(res.status).toBe(201);
  });

  it('PATCH renames a file', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/files/test.tex`)
      .set('Cookie', cookies)
      .send({ new_path: 'renamed.tex' });
    expect(res.status).toBe(200);
  });

  it('DELETE removes a file', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}/files/renamed.tex`).set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  it('rejects file with disallowed extension', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', cookies)
      .send({ path: 'evil.exe', content: 'bad' });
    expect(res.status).toBe(400);
  });
});
