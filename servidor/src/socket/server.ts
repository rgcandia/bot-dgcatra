import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

let io: SocketServer | null = null;

export function initSocket(httpServer: any) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: ['https://dgcatra.alejndrogcandia.online', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      const decoded = jwt.verify(token as string, config.jwt.secret) as { telefono: string; esAdmin: boolean };
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket conectado: ${(socket as any).user?.telefono}`);
  });

  console.log('🔌 Socket.IO inicializado con autenticación');
  return io;
}

export function getIO() {
  return io;
}
