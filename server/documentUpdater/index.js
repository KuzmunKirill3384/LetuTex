import express from 'express';
import * as redisDocStore from './redisDocStore.js';
import { connectMongo } from '../infrastructure/mongoClient.js';
import { config } from '../config.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/doc', async (req, res) => {
  const { projectId, filePath } = req.query;
  if (!projectId || !filePath) return res.status(400).json({ error: 'projectId and filePath required' });
  try {
    const content = await redisDocStore.getDoc(projectId, filePath);
    res.json({ content: content ?? '' });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post('/doc/op', async (req, res) => {
  const { projectId, filePath, op } = req.body || {};
  if (!projectId || !filePath || !op) return res.status(400).json({ error: 'projectId, filePath, op required' });
  try {
    const content = await redisDocStore.applyOp(projectId, filePath, op);
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post('/doc/flush', async (req, res) => {
  const { projectId } = req.body || req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  try {
    await redisDocStore.flushProject(projectId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = parseInt(process.env.DOCUMENT_UPDATER_PORT || '8001', 10);

async function main() {
  if (config.mongoUri) {
    await connectMongo();
  }
  app.listen(port, () => {
    console.log(`Document Updater http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
