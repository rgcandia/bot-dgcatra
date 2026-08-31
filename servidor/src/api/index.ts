import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { initSocket } from '../socket/server.js';
import authRoutes from '../routes/auth.routes.js';
import basesRoutes from '../routes/bases.routes.js';
import sectoresRoutes from '../routes/sectores.routes.js';
import usuariosRoutes from '../routes/usuarios.routes.js';
import ticketsRoutes from '../routes/tickets.routes.js';
import statsRoutes from '../routes/stats.routes.js';
import settingsRoutes from '../routes/settings.routes.js';
import chatRoutes from '../routes/chat.routes.js';
import { config } from '../config/index.js';
import { initSettings, loadSettingsFromDB } from '../config/settings.js';
import { corsOrigin } from '../config/cors.js';
import '../bot/whatsapp.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

initSettings();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Alinear keep-alive con el proxy (cloudflared mantiene conexiones al origen ~30s;
// el default de Node es 5s y puede cortarlas con RST -> "connection reset by peer")
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

initSocket(server);

// --- Sync DB schema (agrega columnas nuevas sin borrar datos) ---
sequelize.sync({ alter: true }).then(() => loadSettingsFromDB()).catch((e) => {
  logger.error({ err: e.message }, 'Error sincronizando DB');
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());

// --- Request logging (diagnóstico) ---
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

// --- Dashboard API ---
app.use('/api/auth', authRoutes);
app.use('/api/bases', basesRoutes);
app.use('/api/sectores', sectoresRoutes);
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

const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`API escuchando en puerto ${PORT}`);
});

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  console.log(`\n🛑 [${signal}] Iniciando cierre ordenado...`);
  server.close(() => console.log('  ✓ HTTP server cerrado'));
  try { await sequelize.close(); console.log('  ✓ DB cerrada'); } catch {}
  try {
    const { client } = await import('../bot/whatsapp.js');
    if (client) { await client.destroy(); console.log('  ✓ WhatsApp cerrado'); }
  } catch {}
  console.log('👋 Chau');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
