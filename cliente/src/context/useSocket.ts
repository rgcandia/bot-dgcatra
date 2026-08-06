import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

interface TicketEvent { id: number; asunto: string; estado: string; userTelefono: string; }
interface TicketFull { id: number; asunto: string; estado: string; descripcion: string; ubicacion: string; prioridad: string; tecnicoAsignado: string | null; solucion: string | null; historial: any[]; createdAt: string; usuario: { nombreCompleto: string; telefono: string }; base: { nombre: string }; sector: { nombre: string } | null; }

function playBeep(freq = 800) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
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
  const [ticketActualizado, setTicketActualizado] = useState<TicketFull | null>(null);

  useEffect(() => {
    if (!user?.token) return;

    const socket = io(SOCKET_URL, { auth: { token: user.token }, transports: ['websocket', 'polling'] });

    socket.on('ticket-creado', (ticket: TicketEvent) => {
      playBeep(800);
      setTick(t => t + 1);
      setNotificacion(`Nuevo ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
    });

    socket.on('ticket-asignado', (ticket: any) => {
      setTick(t => t + 1);
      if (user?.nombre && ticket.tecnicoAsignado === user.nombre) {
        playBeep(1200);
        setTimeout(() => playBeep(1200), 150);
        setNotificacion(`Se te asignó el ticket #${ticket.id}: ${ticket.asunto?.substring(0, 40)}`);
      }
    });

    socket.on('ticket-actualizado', (ticket: TicketFull) => {
      setTick(t => t + 1);
      setTicketActualizado(ticket);
    });

    socket.on('usuario-registrado', () => {
      setTick(t => t + 1);
    });

    socket.on('datos-actualizados', () => {
      setTick(t => t + 1);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [user?.token]);

  const limpiarNotificacion = useCallback(() => setNotificacion(null), []);

  return { notificacion, limpiarNotificacion, tick, ticketActualizado };
}
