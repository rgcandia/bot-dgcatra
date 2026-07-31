import { User } from '../models/models.js';
import { guardarMensaje } from './historial.js';

const cache = new Map<string, { user: User | null; ts: number }>();
const TTL = 60_000;

export interface SessionUser {
  telefono: string;
  nombreCompleto: string | null;
  email: string | null;
  baseId: number | null;
  sectorId: number | null;
  activo: boolean;
  esAdmin: boolean;
  registroCompleto: boolean;
  pasoRegistro: number;
  context: any;
}

export async function obtenerUsuario(telefono: string): Promise<SessionUser> {
  const entry = cache.get(telefono);
  const now = Date.now();

  if (entry && (now - entry.ts) < TTL) {
    return (entry.user ?? createDefault(telefono)) as SessionUser;
  }

  const user = await User.findByPk(telefono);
  const sessionUser = (user ?? createDefault(telefono)) as unknown as SessionUser;

  cache.set(telefono, { user: user as unknown as User | null, ts: now });
  return sessionUser;
}

export async function guardarUsuario(telefono: string, data: Partial<SessionUser>) {
  if (data.context !== undefined) {
    data.context = { ...data.context, _lastActivity: Date.now() };
  }

  const [user] = await User.upsert({
    telefono,
    ...data,
  } as any);
  cache.set(telefono, { user, ts: Date.now() });
  return user as unknown as SessionUser;
}

export async function registrarMensajeEntrante(telefono: string, texto: string) {
  guardarMensaje(telefono, texto, 'inbound');
}

export async function registrarMensajeSaliente(telefono: string, texto: string) {
  guardarMensaje(telefono, texto, 'outbound');
}

export function invalidarCache(telefono: string) {
  cache.delete(telefono);
}

function createDefault(telefono: string) {
  return {
    telefono,
    nombreCompleto: null,
    email: null,
    baseId: null,
    sectorId: null,
    activo: true,
    esAdmin: false,
    registroCompleto: false,
    pasoRegistro: 0,
    context: null,
  };
}
