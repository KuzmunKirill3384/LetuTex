import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const dataDir = process.env.FILE_STORE_DATA_DIR || path.join(rootDir, 'data', 'file-store');
const storeDir = path.join(dataDir, 'blobs');

fs.mkdirSync(storeDir, { recursive: true });

function safePath(projectId, filePath) {
  const normalized = filePath.replace(/\\/g, '/').replace(/\.\./g, '');
  return path.join(storeDir, projectId, normalized);
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();

app.post('/upload', upload.single('file'), (req, res) => {
  const projectId = req.body?.projectId || req.query?.projectId;
  const filePath = req.body?.path || req.query?.path;
  if (!projectId || !filePath) {
    return res.status(400).json({ error: 'projectId and path required' });
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const full = safePath(projectId, filePath);
  if (!full.startsWith(path.resolve(storeDir))) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  try {
    ensureParentDir(full);
    fs.writeFileSync(full, req.file.buffer);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get('/download', (req, res) => {
  const projectId = req.query.projectId;
  const filePath = req.query.path || '';
  if (!projectId || !filePath) {
    return res.status(400).json({ error: 'projectId and path required' });
  }
  const full = safePath(projectId, filePath);
  if (!fs.existsSync(full) || !full.startsWith(path.resolve(storeDir))) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(full, { dotfiles: 'deny' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = parseInt(process.env.FILE_STORE_PORT || '8004', 10);
app.listen(port, () => {
  console.log(`File Store http://localhost:${port}`);
});
