import { MongoClient } from 'mongodb';
import { config } from '../config.js';

let client = null;
let db = null;

export async function connectMongo() {
  if (db) return db;
  if (!config.mongoUri) throw new Error('MONGO_URI is not set');
  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db();
  return db;
}

export function getDb() {
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
