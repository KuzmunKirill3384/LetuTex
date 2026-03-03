import bcrypt from 'bcrypt';
import { connectMongo } from './mongoClient.js';

const BCRYPT_ROUNDS = 10;

function toPublic(data) {
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    display_name: data.display_name || data.username,
  };
}

async function usersColl() {
  const db = await connectMongo();
  return db.collection('users');
}

export async function ensureDemoUser() {
  const coll = await usersColl();
  const demo = await coll.findOne({ username: 'demo' });
  if (demo) return;
  const hash = bcrypt.hashSync('demo', BCRYPT_ROUNDS);
  await coll.insertOne({
    id: 'demo',
    username: 'demo',
    password_hash: hash,
    display_name: 'Demo',
  });
}

export async function authenticate(username, password) {
  await ensureDemoUser();
  const coll = await usersColl();
  const data = await coll.findOne({ username });
  if (!data || !bcrypt.compareSync(password, data.password_hash)) return null;
  return toPublic(data);
}

export async function getById(userId) {
  await ensureDemoUser();
  const coll = await usersColl();
  const data = await coll.findOne({ id: userId });
  return toPublic(data);
}

export async function register(username, password, displayName) {
  await ensureDemoUser();
  const coll = await usersColl();
  const existing = await coll.findOne({ username });
  if (existing) return null;
  const id = username;
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  await coll.insertOne({
    id,
    username,
    password_hash: hash,
    display_name: displayName || username,
  });
  return toPublic({ id, username, password_hash: hash, display_name: displayName || username });
}

export async function userExists(username) {
  const coll = await usersColl();
  const doc = await coll.findOne({ username });
  return !!doc;
}
