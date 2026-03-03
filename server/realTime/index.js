import { createServer } from 'http';
import { pathToFileURL } from 'url';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const documentUpdaterUrl = config.documentUpdaterUrl || 'http://localhost:8001';
const roomCounts = new Map();
const REALTIME_OP_CHANNEL = 'realtime:op';
let redisSub = null;

function getRedisSub(io) {
  if (!config.redisUri) return null;
  if (redisSub) return redisSub;
  redisSub = new Redis(config.redisUri);
  redisSub.subscribe(REALTIME_OP_CHANNEL);
  redisSub.on('message', (channel, msg) => {
    if (channel !== REALTIME_OP_CHANNEL) return;
    try {
      const { roomId, op, userId } = JSON.parse(msg);
      if (roomId && op) io.to(roomId).emit('op', op, userId);
    } catch { /* ignore */ }
  });
  return redisSub;
}

function getRedisPub() {
  if (!config.redisUri) return null;
  return new Redis(config.redisUri);
}

function getRoomId(projectId, filePath) {
  return `doc:${projectId}:${filePath}`;
}

async function fetchDoc(projectId, filePath) {
  const u = new URL(documentUpdaterUrl + '/doc');
  u.searchParams.set('projectId', projectId);
  u.searchParams.set('filePath', filePath);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error('Document Updater getDoc failed');
  const data = await res.json();
  return data.content ?? '';
}

async function applyOp(projectId, filePath, op) {
  const res = await fetch(documentUpdaterUrl + '/doc/op', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, filePath, op }),
  });
  if (!res.ok) throw new Error('Document Updater applyOp failed');
  const data = await res.json();
  return data.content;
}

async function flushProject(projectId) {
  const res = await fetch(documentUpdaterUrl + '/doc/flush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error('Document Updater flush failed');
}

function trackRoom(roomId, delta) {
  const count = (roomCounts.get(roomId) || 0) + delta;
  if (count <= 0) roomCounts.delete(roomId);
  else roomCounts.set(roomId, count);
  return count;
}

export function createRealtimeServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.allowedOrigins, credentials: true },
    path: '/realtime',
  });

  if (config.redisUri) {
    getRedisSub(io);
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      socket.userId = payload.sub;
      socket.username = payload.username || payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join', async (payload, ack) => {
      const { projectId, filePath } = payload || {};
      if (!projectId || !filePath) {
        ack?.({ error: 'projectId and filePath required' });
        return;
      }
      const roomId = getRoomId(projectId, filePath);
      socket.projectId = projectId;
      socket.filePath = filePath;
      socket.roomId = roomId;
      socket.join(roomId);
      trackRoom(roomId, 1);
      try {
        const content = await fetchDoc(projectId, filePath);
        ack?.({ content });
      } catch (e) {
        ack?.({ error: e.message });
      }
    });

    socket.on('op', async (op, ack) => {
      const projectId = socket.projectId;
      const filePath = socket.filePath;
      if (!projectId || !filePath) {
        ack?.({ error: 'Join a document first' });
        return;
      }
      try {
        await applyOp(projectId, filePath, op);
        const pub = getRedisPub();
        if (pub) {
          pub.publish(REALTIME_OP_CHANNEL, JSON.stringify({ roomId: socket.roomId, op, userId: socket.userId }));
        } else {
          socket.to(socket.roomId).emit('op', op);
        }
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: e.message });
      }
    });

    socket.on('cursor', (pos) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('cursor', {
          userId: socket.userId,
          username: socket.username,
          ...pos,
        });
      }
    });

    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId) {
        trackRoom(roomId, -1);
        const count = roomCounts.get(roomId) || 0;
        if (count === 0) {
          const projectId = socket.projectId;
          if (projectId) {
            flushProject(projectId).catch((err) => console.error('flush on disconnect', err));
          }
        }
      }
    });
  });

  return io;
}

const port = parseInt(process.env.REALTIME_PORT || '8002', 10);

async function main() {
  const httpServer = createServer();
  createRealtimeServer(httpServer);
  httpServer.listen(port, () => {
    console.log(`Real-time ws://localhost:${port}/realtime`);
  });
}

export default { createRealtimeServer };

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
