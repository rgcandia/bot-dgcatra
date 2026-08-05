import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

interface TicketEvent { id: number; asunto: string; estado: string; userTelefono: string; }

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user?.token) return;

    const socket = io(SOCKET_URL, { auth: { token: user.token }, transports: ['websocket', 'polling'] });

    socket.on('ticket-creado', (ticket: TicketEvent) => {
      setTick(t => t + 1);
      if (ticket.userTelefono !== user.telefono)
        setNotificacion(`Nuevo ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
    });

    socket.on('ticket-actualizado', () => {
      setTick(t => t + 1);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [user?.token]);

  const limpiarNotificacion = useCallback(() => setNotificacion(null), []);

  return { notificacion, limpiarNotificacion, tick };
}
