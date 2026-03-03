import Redis from 'ioredis';
import { connectMongo } from '../infrastructure/mongoClient.js';
import { config } from '../config.js';

let redis = null;

function getRedis() {
  if (!config.redisUri) return null;
  if (!redis) redis = new Redis(config.redisUri, { maxRetriesPerRequest: 3 });
  return redis;
}

const DOC_KEY_PREFIX = 'doc:';
const KEY_TTL_SEC = 3600;

function docKey(projectId, filePath) {
  const normalized = filePath.replace(/\//g, ':');
  return `${DOC_KEY_PREFIX}${projectId}:${normalized}`;
}

export async function getDoc(projectId, filePath) {
  const r = getRedis();
  if (r) {
    const key = docKey(projectId, filePath);
    const content = await r.get(key);
    if (content !== null) return content;
  }
  if (!config.useMongo) return null;
  const db = await connectMongo();
  const doc = await db.collection('project_files').findOne({ project_id: projectId, path: filePath });
  const text = doc?.content ?? '';
  if (r) {
    await r.setex(docKey(projectId, filePath), KEY_TTL_SEC, text);
  }
  return text;
}

export async function setDoc(projectId, filePath, content) {
  const r = getRedis();
  if (r) {
    await r.setex(docKey(projectId, filePath), KEY_TTL_SEC, content);
  }
}

export async function applyOp(projectId, filePath, op) {
  const content = await getDoc(projectId, filePath);
  if (content === null) return null;
  let next = content;
  if (op.type === 'insert' && typeof op.pos === 'number' && op.text != null) {
    const pos = Math.max(0, Math.min(op.pos, next.length));
    next = next.slice(0, pos) + op.text + next.slice(pos);
  } else if (op.type === 'delete' && typeof op.pos === 'number' && typeof op.len === 'number') {
    const pos = Math.max(0, Math.min(op.pos, next.length));
    const end = Math.min(next.length, pos + op.len);
    next = next.slice(0, pos) + next.slice(end);
  }
  await setDoc(projectId, filePath, next);
  return next;
}

export async function flushProject(projectId) {
  if (!config.useMongo) return;
  const r = getRedis();
  if (!r) return;
  const pattern = docKey(projectId, '*');
  const keys = await r.keys(pattern);
  const db = await connectMongo();
  const coll = db.collection('project_files');
  for (const key of keys) {
    const filePath = key.replace(DOC_KEY_PREFIX + projectId + ':', '').replace(/:/g, '/');
    const content = await r.get(key);
    if (content !== null) {
      await coll.updateOne(
        { project_id: projectId, path: filePath },
        { $set: { content, updated_at: new Date().toISOString() } },
        { upsert: true },
      );
    }
    await r.del(key);
  }
}
