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
import { config } from '../config/index.js';
import '../bot/whatsapp.js';

const app = express();
const server = http.createServer(app);
initSocket(server);

const allowedOrigins = [
  'https://dgcatra.alejndrogcandia.online',
  'http://localhost:5173',
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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// --- Global Error Handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Error no manejado:', err.message);
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🚪 API escuchando en puerto ${PORT}`);
});
