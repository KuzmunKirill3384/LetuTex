import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

const port = parseInt(process.env.PORT || '8000', 10);
const server = app.listen(port, async () => {
  console.log(`\n  LetuTEX`);
  console.log(`  http://localhost:${port}`);
  if (config.redisUri && config.documentUpdaterUrl) {
    const { createRealtimeServer } = await import('./realTime/index.js');
    createRealtimeServer(server);
    console.log(`  Real-time /realtime (Socket.IO)`);
  }
  console.log(`  ${new Date().toISOString()}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Порт ${port} занят. Остановите другой процесс или убейте его:\n`);
    console.error(`  lsof -ti:${port} | xargs kill -9\n`);
    process.exit(1);
  }
  throw err;
});

function shutdown(signal) {
  console.log(`\n  ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('  Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('  Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
