import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { errorMiddleware, NotFoundError } from './exceptions.js';
import authRoutes from './routes/auth.js';
import templatesRoutes from './routes/templates.js';
import projectRoutes from './routes/projects.js';
import fileRoutes from './routes/files.js';
import compileRoutes from './routes/compile.js';
import historyRoutes from './routes/history.js';
import downloadRoutes from './routes/download.js';
import { getCurrentUser } from './middleware/auth.js';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  app.use((req, res, next) => {
    const start = Date.now();
    const id = req.headers['x-request-id'] || Math.random().toString(36).slice(2, 10);
    res.setHeader('X-Request-Id', id);
    res.on('finish', () => {
      const ms = Date.now() - start;
      const user = req.cookies?.user_id || '-';
      const log = `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms user=${user}`;
      if (res.statusCode >= 500) console.error(log);
      else if (res.statusCode >= 400) console.warn(log);
      else console.log(log);
    });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/templates', templatesRoutes);

  const projectsRouter = express.Router({ mergeParams: true });
  projectsRouter.use(getCurrentUser);
  projectsRouter.use('/', projectRoutes);
  projectsRouter.use('/', fileRoutes);
  projectsRouter.use('/', compileRoutes);
  projectsRouter.use('/', historyRoutes);
  projectsRouter.use('/', downloadRoutes);
  app.use('/api/projects', projectsRouter);

  fs.mkdirSync(config.projectsDir, { recursive: true });

  app.use(
    express.static(config.staticDir, {
      maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
      etag: true,
    }),
  );

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next(new NotFoundError('API route not found'));
    const indexPath = path.join(config.staticDir, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    next();
  });

  app.use(errorMiddleware);

  return app;
}
