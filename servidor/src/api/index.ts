import 'dotenv/config';
import http from 'http';
import { createApp } from './app.js';
import { initSocket } from '../socket/server.js';
import { config } from '../config/index.js';
import { initSettings, loadSettingsFromDB } from '../config/settings.js';
import '../bot/whatsapp.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

initSettings();

const app = createApp();
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
