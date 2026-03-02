import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leti-collab-'));
let ownerCookies = '';
let readerCookies = '';
let writerCookies = '';
let projectId = '';
const ownerName = 'owner_' + Date.now();
const readerName = 'reader_' + Date.now();
const writerName = 'writer_' + Date.now();

beforeAll(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.SECRET_KEY = 'test-secret';
  const { createApp } = await import('../../../server/app.js');
  app = createApp();

  await request(app).post('/api/auth/register').send({ username: ownerName, password: 'pass123' });
  await request(app).post('/api/auth/register').send({ username: readerName, password: 'pass123' });
  await request(app).post('/api/auth/register').send({ username: writerName, password: 'pass123' });

  ownerCookies =
    (await request(app).post('/api/auth/login').send({ username: ownerName, password: 'pass123' })).headers[
      'set-cookie'
    ]?.join('; ') || '';
  readerCookies =
    (await request(app).post('/api/auth/login').send({ username: readerName, password: 'pass123' })).headers[
      'set-cookie'
    ]?.join('; ') || '';
  writerCookies =
    (await request(app).post('/api/auth/login').send({ username: writerName, password: 'pass123' })).headers[
      'set-cookie'
    ]?.join('; ') || '';

  const projRes = await request(app).post('/api/projects').set('Cookie', ownerCookies).send({ name: 'Collab Project' });
  projectId = projRes.body.id;

  await request(app)
    .post(`/api/projects/${projectId}/collaborators`)
    .set('Cookie', ownerCookies)
    .send({ user_id: readerName, role: 'read' });
  await request(app)
    .post(`/api/projects/${projectId}/collaborators`)
    .set('Cookie', ownerCookies)
    .send({ user_id: writerName, role: 'write' });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Collaborator access control', () => {
  it('reader can view project', async () => {
    const res = await request(app).get(`/api/projects/${projectId}`).set('Cookie', readerCookies);
    expect(res.status).toBe(200);
  });

  it('reader can read files', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files/main.tex`).set('Cookie', readerCookies);
    expect(res.status).toBe(200);
  });

  it('reader cannot create files (write denied)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', readerCookies)
      .send({ path: 'hacked.tex', content: 'hacked' });
    expect(res.status).toBe(403);
  });

  it('reader cannot save files (write denied)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/files/main.tex`)
      .set('Cookie', readerCookies)
      .send({ content: 'hacked' });
    expect(res.status).toBe(403);
  });

  it('writer can create files', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', writerCookies)
      .send({ path: 'writer.tex', content: 'ok' });
    expect(res.status).toBe(201);
  });

  it('writer can save files', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/files/writer.tex`)
      .set('Cookie', writerCookies)
      .send({ content: 'updated' });
    expect(res.status).toBe(200);
  });

  it('writer cannot delete project (owner only)', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`).set('Cookie', writerCookies);
    expect(res.status).toBe(403);
  });

  it('reader cannot add collaborators (owner only)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/collaborators`)
      .set('Cookie', readerCookies)
      .send({ user_id: 'someone', role: 'read' });
    expect(res.status).toBe(403);
  });

  it('unauthorized user cannot access project', async () => {
    const otherName = 'outsider_' + Date.now();
    await request(app).post('/api/auth/register').send({ username: otherName, password: 'pass123' });
    const loginRes = await request(app).post('/api/auth/login').send({ username: otherName, password: 'pass123' });
    const outsiderCookies = loginRes.headers['set-cookie']?.join('; ') || '';
    const res = await request(app).get(`/api/projects/${projectId}`).set('Cookie', outsiderCookies);
    expect(res.status).toBe(403);
  });

  it('owner can list collaborators', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/collaborators`).set('Cookie', ownerCookies);
    expect(res.status).toBe(200);
    expect(res.body.collaborators.length).toBe(2);
  });

  it('owner can remove collaborator', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/collaborators/${readerName}`)
      .set('Cookie', ownerCookies);
    expect(res.status).toBe(200);
    expect(res.body.collaborators.length).toBe(1);
  });
});
