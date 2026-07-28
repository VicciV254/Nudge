import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind Vercel/Render/Railway: needed for req.ip and rate limiting to see
  // the real client rather than the proxy.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, service: 'nudge-api', ts: new Date().toISOString() })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/calendar', calendarRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;
