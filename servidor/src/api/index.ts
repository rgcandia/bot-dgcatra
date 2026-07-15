import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import http from 'http';
import { initSocket } from '../socket/server.js';
import { mensajesQueue } from '../queue/index.js';
import authRoutes from '../routes/auth.routes.js';
import basesRoutes from '../routes/bases.routes.js';
import sectoresRoutes from '../routes/sectores.routes.js';
import usuariosRoutes from '../routes/usuarios.routes.js';
import ticketsRoutes from '../routes/tickets.routes.js';
import statsRoutes from '../routes/stats.routes.js';
import { config } from '../config/index.js';

const app = express();
const server = http.createServer(app);
initSocket(server);

const allowedOrigins = [
  'https://dgcatra.alejndrogcandia.online',
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); }
}));

// --- Webhook Meta ---
function verificarFirma(rawBody: string | undefined, signatureHeader: string): boolean {
  if (!rawBody) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;
  const esperada = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const recibida = signatureHeader?.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida || ''));
}

app.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).send('Verification failed');
});

app.post('/webhook/meta', async (req, res) => {
  const firmaValida = verificarFirma((req as any).rawBody, req.headers['x-hub-signature-256'] as string);
  if (!firmaValida) return res.status(401).json({ error: 'Invalid signature' });
  await mensajesQueue.add('mensaje', {
    payload: req.body,
    messageId: req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id,
    receivedAt: new Date().toISOString()
  });
  res.status(200).send('OK');
});

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
