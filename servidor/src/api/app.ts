import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../routes/auth.routes.js';
import basesRoutes from '../routes/bases.routes.js';
import usuariosRoutes from '../routes/usuarios.routes.js';
import ticketsRoutes from '../routes/tickets.routes.js';
import statsRoutes from '../routes/stats.routes.js';
import settingsRoutes from '../routes/settings.routes.js';
import chatRoutes from '../routes/chat.routes.js';
import { corsOrigin } from '../config/cors.js';
import { logger } from '../config/logger.js';

/**
 * Construye la app Express (middlewares + rutas) SIN efectos colaterales:
 * no levanta el puerto, no sincroniza la DB y no inicializa WhatsApp.
 * Eso permite usarla tal cual desde los tests de integración (supertest).
 * Los efectos colaterales quedan en `src/api/index.ts`.
 */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(helmet());
  app.use(express.json());

  // --- Request logging (diagnóstico) ---
  // En tests se omite para no ensuciar la salida con una línea por request.
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        logger.info({
          ip: req.ip,
          xff: req.headers['x-forwarded-for'],
          cf: req.headers['cf-connecting-ip'],
          m: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ms: Date.now() - start,
        }, 'req');
      });
      next();
    });
  }

  // --- Dashboard API ---
  app.use('/api/auth', authRoutes);
  app.use('/api/bases', basesRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/tickets', chatRoutes);
  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/settings', settingsRoutes);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/bot', (_req, res) => {
    import('../bot/whatsapp.js').then(({ client }) => {
      const connected = !!(client as any)?.info?.wid;
      const phone = connected ? (client as any).info.wid._serialized?.split('@')[0] : null;
      res.json({ connected, phone });
    }).catch(() => res.json({ connected: false, phone: null }));
  });

  // --- Global Error Handler ---
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err: err.message }, 'Error no manejado');
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
