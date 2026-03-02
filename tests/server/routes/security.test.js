import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';

let app;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leti-security-'));
let cookies = '';
let projectId = '';
const username = 'securityuser_' + Date.now();

beforeAll(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.SECRET_KEY = 'test-secret';
  const { createApp } = await import('../../../server/app.js');
  app = createApp();

  await request(app).post('/api/auth/register').send({ username, password: 'pass123' });
  const loginRes = await request(app).post('/api/auth/login').send({ username, password: 'pass123' });
  cookies = loginRes.headers['set-cookie']?.join('; ') || '';

  const projRes = await request(app).post('/api/projects').set('Cookie', cookies).send({ name: 'Security Test' });
  projectId = projRes.body.id;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Path traversal protection', () => {
  it('rejects path with ..', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', cookies)
      .send({ path: '../../../etc/passwd', content: 'evil' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects absolute path', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', cookies)
      .send({ path: '/etc/passwd.tex', content: 'evil' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects GET with path traversal', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files/../../../etc/passwd`).set('Cookie', cookies);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('ZIP upload security (zip-slip prevention)', () => {
  it('extracts valid ZIP correctly', async () => {
    const zip = new AdmZip();
    zip.addFile('chapter/intro.tex', Buffer.from('\\section{Intro}'));
    zip.addFile('main.tex', Buffer.from('\\documentclass{article}'));

    const res = await request(app)
      .post(`/api/projects/${projectId}/upload-zip`)
      .set('Cookie', cookies)
      .attach('file', zip.toBuffer(), 'test.zip');

    expect(res.status).toBe(200);
    expect(res.body.extracted).toContain('main.tex');
    expect(res.body.extracted).toContain('chapter/intro.tex');
  });

  it('ignores zip entries with ../', async () => {
    const zip = new AdmZip();
    zip.addFile('../../../evil.tex', Buffer.from('evil'));
    zip.addFile('safe.tex', Buffer.from('safe'));

    const res = await request(app)
      .post(`/api/projects/${projectId}/upload-zip`)
      .set('Cookie', cookies)
      .attach('file', zip.toBuffer(), 'zipslip.zip');

    expect(res.status).toBe(200);
    expect(res.body.extracted).toContain('safe.tex');
    expect(res.body.extracted).not.toContain('../../../evil.tex');
  });

  it('handles absolute paths safely (AdmZip normalizes them)', async () => {
    const zip = new AdmZip();
    zip.addFile('/etc/passwd.tex', Buffer.from('content'));
    zip.addFile('valid.tex', Buffer.from('valid'));

    const res = await request(app)
      .post(`/api/projects/${projectId}/upload-zip`)
      .set('Cookie', cookies)
      .attach('file', zip.toBuffer(), 'abs.zip');

    expect(res.status).toBe(200);
    expect(res.body.extracted).toContain('valid.tex');
  });

  it('ignores hidden files', async () => {
    const zip = new AdmZip();
    zip.addFile('.hidden.tex', Buffer.from('hidden'));
    zip.addFile('normal.tex', Buffer.from('normal'));

    const res = await request(app)
      .post(`/api/projects/${projectId}/upload-zip`)
      .set('Cookie', cookies)
      .attach('file', zip.toBuffer(), 'hidden.zip');

    expect(res.status).toBe(200);
    expect(res.body.extracted).toContain('normal.tex');
    expect(res.body.extracted).not.toContain('.hidden.tex');
  });

  it('ignores __MACOSX and .DS_Store', async () => {
    const zip = new AdmZip();
    zip.addFile('__MACOSX/._file', Buffer.from('mac'));
    zip.addFile('.DS_Store', Buffer.from('ds'));
    zip.addFile('doc.tex', Buffer.from('doc'));

    const res = await request(app)
      .post(`/api/projects/${projectId}/upload-zip`)
      .set('Cookie', cookies)
      .attach('file', zip.toBuffer(), 'macos.zip');

    expect(res.status).toBe(200);
    expect(res.body.extracted).toContain('doc.tex');
    expect(res.body.extracted.some((e) => e.includes('MACOSX'))).toBe(false);
    expect(res.body.extracted.some((e) => e.includes('DS_Store'))).toBe(false);
  });
});
