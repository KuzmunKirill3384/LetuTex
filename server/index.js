import { createApp } from './app.js';

const app = createApp();

const port = parseInt(process.env.PORT || '8000', 10);
const server = app.listen(port, () => {
  console.log(`\n  LetuTEX`);
  console.log(`  http://localhost:${port}`);
  console.log(`  ${new Date().toISOString()}\n`);
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
