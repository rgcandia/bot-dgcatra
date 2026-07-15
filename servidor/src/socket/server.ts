import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function initSocket(httpServer: any) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: ['https://dgcatra.alejndrogcandia.online', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
    },
  });
  console.log('🔌 Socket.IO inicializado');
  return io;
}

export function getIO() {
  return io;
}
