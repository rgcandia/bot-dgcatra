import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { initSocket } from '../socket/server.js';
import authRoutes from '../routes/auth.routes.js';
import basesRoutes from '../routes/bases.routes.js';
import sectoresRoutes from '../routes/sectores.routes.js';
import usuariosRoutes from '../routes/usuarios.routes.js';
import ticketsRoutes from '../routes/tickets.routes.js';
import statsRoutes from '../routes/stats.routes.js';
import settingsRoutes from '../routes/settings.routes.js';
import { config } from '../config/index.js';
import { initSettings } from '../config/settings.js';
import '../bot/whatsapp.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

initSettings();

const app = express();
const server = http.createServer(app);
initSocket(server);

const allowedOrigins = [
  'https://dgcatra.alejndrogcandia.online',
  'http://localhost:5173',
  'http://172.17.0.202:5173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// --- Dashboard API ---
app.use('/api/auth', authRoutes);
app.use('/api/bases', basesRoutes);
app.use('/api/sectores', sectoresRoutes);
app.use('/api/usuarios', usuariosRoutes);
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
