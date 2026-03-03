import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';
import { connectMongo } from '../infrastructure/mongoClient.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const reposDir = process.env.GIT_REPOS_DIR || path.join(rootDir, 'data', 'git-repos');
const webApiUrl = process.env.WEB_API_URL || 'http://localhost:8000';
const gitBridgeUrl = process.env.GIT_BRIDGE_URL || 'http://localhost:8005';
const gitBridgeApiKey = process.env.GIT_BRIDGE_API_KEY || '';

fs.mkdirSync(reposDir, { recursive: true });

const app = express();
app.use(express.json({ limit: '1mb' }));

async function requireProjectAccess(projectId, userId) {
  const res = await fetch(`${webApiUrl}/api/projects/${projectId}`, {
    headers: { Cookie: `user_id=${userId}` },
  });
  if (!res.ok) throw new Error('Project access denied');
}

async function syncDirToMongo(projectId, dirPath) {
  const db = await connectMongo();
  const coll = db.collection('project_files');
  const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (e.isDirectory()) continue;
    const rel = path.relative(dirPath, path.join(e.path || '', e.name)).replace(/\\/g, '/');
    if (rel.includes('..') || path.isAbsolute(rel)) continue;
    const full = path.join(dirPath, rel);
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      content = fs.readFileSync(full);
      continue;
    }
    await coll.updateOne(
      { project_id: projectId, path: rel },
      { $set: { content, updated_at: new Date().toISOString() } },
      { upsert: true },
    );
  }
}

app.post('/clone', async (req, res) => {
  if (gitBridgeApiKey && req.headers['x-git-bridge-key'] !== gitBridgeApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { projectId, userId, remoteUrl } = req.body || {};
  if (!projectId || !userId || !remoteUrl) {
    return res.status(400).json({ error: 'projectId, userId, remoteUrl required' });
  }
  let tempDir;
  try {
    await requireProjectAccess(projectId, userId);
    tempDir = fs.mkdtempSync(path.join(reposDir, `clone-${projectId}-`));
    const git = simpleGit({ baseDir: tempDir });
    await git.clone(remoteUrl, tempDir, ['--depth', '1']);
    await syncDirToMongo(projectId, tempDir);
    const barePath = path.join(reposDir, `${projectId}.git`);
    if (fs.existsSync(barePath)) fs.rmSync(barePath, { recursive: true });
    const bare = simpleGit();
    await bare.clone(tempDir, barePath, ['--bare']);
    const hooksDir = path.join(barePath, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    const syncUrl = `${gitBridgeUrl.replace(/\/$/, '')}/sync/${projectId}`;
    const hookBody = `#!/bin/sh\ncurl -s -X POST -H "X-Git-Bridge-Key: ${gitBridgeApiKey}" "${syncUrl}" || true\n`;
    fs.writeFileSync(path.join(hooksDir, 'post-receive'), hookBody);
    fs.chmodSync(path.join(hooksDir, 'post-receive'), 0o755);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
    }
  }
});

app.post('/sync/:projectId', async (req, res) => {
  if (gitBridgeApiKey && req.headers['x-git-bridge-key'] !== gitBridgeApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const projectId = req.params.projectId;
  const barePath = path.join(reposDir, `${projectId}.git`);
  if (!fs.existsSync(barePath)) return res.status(404).json({ error: 'Repo not found' });
  let workTree;
  try {
    workTree = fs.mkdtempSync(path.join(reposDir, `wt-${projectId}-`));
    const { execSync } = await import('child_process');
    execSync(`git --work-tree="${workTree}" --git-dir="${barePath}" checkout -f HEAD`, { stdio: 'inherit' });
    await syncDirToMongo(projectId, workTree);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  } finally {
    if (workTree && fs.existsSync(workTree)) {
      try { fs.rmSync(workTree, { recursive: true }); } catch { /* ignore */ }
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/git', (req, res, next) => {
  const match = req.path.match(/^\/([a-zA-Z0-9_-]+)\.git(\/.*|)$/);
  if (!match) return next();
  const projectId = match[1];
  const pathInfo = `/${projectId}.git${match[2] || ''}`;
  const repoPath = path.join(reposDir, `${projectId}.git`);
  if (!fs.existsSync(repoPath)) return res.status(404).send('Repo not found');
  const qs = new URL(req.url, 'http://x').searchParams.toString();
  const env = {
    ...process.env,
    GIT_PROJECT_ROOT: reposDir,
    GIT_HTTP_EXPORT_ALL: '1',
    REQUEST_METHOD: req.method,
    CONTENT_TYPE: req.headers['content-type'] || '',
    QUERY_STRING: qs,
    PATH_INFO: pathInfo,
  };
  const proc = spawn('git', ['http-backend'], { env });
  req.pipe(proc.stdin);
  proc.stdout.pipe(res);
  proc.stderr.on('data', (d) => console.error(d.toString()));
});

const port = parseInt(process.env.GIT_BRIDGE_PORT || '8005', 10);

async function main() {
  if (config.mongoUri) await connectMongo();
  app.listen(port, () => {
    console.log(`Git Bridge http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
