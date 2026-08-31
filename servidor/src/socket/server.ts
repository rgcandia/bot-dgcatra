import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { usuarioActivo } from '../middleware/auth.js';
import { corsOrigin } from '../config/cors.js';
import { logger } from '../config/logger.js';

let io: SocketServer | null = null;
let botStatus: { connected: boolean; phone?: string } = { connected: false };

export function setBotConnected(phone?: string) {
  botStatus = { connected: true, phone };
  if (io) io.emit('bot-status', botStatus);
}

export function setBotDisconnected() {
  botStatus = { connected: false };
  if (io) io.emit('bot-status', botStatus);
}

export function emitQR(qr: string) {
  if (io) io.emit('bot-qr', qr);
}

export function getBotStatus() {
  return botStatus;
}

export function initSocket(httpServer: any) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      const decoded = jwt.verify(token as string, config.jwt.secret) as { telefono: string; esAdmin: boolean; superAdmin?: boolean };
      if (!decoded.superAdmin) {
        const activo = await usuarioActivo(decoded.telefono);
        if (!activo) return next(new Error('Usuario desactivado'));
      }
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket conectado: ${(socket as any).user?.telefono}`);
    socket.emit('bot-status', botStatus);
  });

  logger.info('Socket.IO inicializado con autenticación');
  return io;
}

export function getIO() {
  return io;
}
