import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const BCRYPT_ROUNDS = 10;

function legacyHash(pwd) {
  return crypto.createHash('sha256').update(pwd, 'utf8').digest('hex');
}

const userFile = path.join(config.dataDir, 'users.json');
let cache = null;

function ensureLoaded() {
  if (cache) return;
  try {
    if (fs.existsSync(userFile)) cache = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  } catch {
    cache = {};
  }
  if (!cache || Object.keys(cache).length === 0) {
    const hash = bcrypt.hashSync('demo', BCRYPT_ROUNDS);
    cache = { demo: { id: 'demo', username: 'demo', password_hash: hash, display_name: 'Demo' } };
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    persist();
  }
}

function persist() {
  fs.mkdirSync(path.dirname(userFile), { recursive: true });
  fs.writeFileSync(userFile, JSON.stringify(cache, null, 2), 'utf8');
}

function toPublic(data) {
  if (!data) return null;
  return { id: data.id, username: data.username, display_name: data.display_name || data.username };
}

function verifyPassword(password, storedHash) {
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, storedHash);
  }
  return storedHash === legacyHash(password);
}

function upgradeHashIfNeeded(username, password, storedHash) {
  if (!storedHash.startsWith('$2')) {
    cache[username].password_hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    persist();
  }
}

export function authenticate(username, password) {
  ensureLoaded();
  const data = cache[username];
  if (!data || !verifyPassword(password, data.password_hash)) return null;
  upgradeHashIfNeeded(username, password, data.password_hash);
  return toPublic(data);
}

export function getById(userId) {
  ensureLoaded();
  for (const data of Object.values(cache)) {
    if (data?.id === userId) return toPublic(data);
  }
  return null;
}

export function register(username, password, displayName) {
  ensureLoaded();
  if (cache[username]) return null;
  const id = username;
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  cache[username] = { id, username, password_hash: hash, display_name: displayName || username };
  persist();
  return toPublic(cache[username]);
}

export function userExists(username) {
  ensureLoaded();
  return !!cache[username];
}
