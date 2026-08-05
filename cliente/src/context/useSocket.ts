import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

interface TicketEvent { id: number; asunto: string; estado: string; userTelefono: string; }

function playSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user?.token) return;

    const socket = io(SOCKET_URL, { auth: { token: user.token }, transports: ['websocket', 'polling'] });

    socket.on('ticket-creado', (ticket: TicketEvent) => {
      playSound();
      setTick(t => t + 1);
      setNotificacion(`🎫 Nuevo ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
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
