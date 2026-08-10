import { User } from '../models/models.js';
import { guardarMensaje } from './historial.js';
import { TicketContextSchema } from './schemas.js';
import { logger } from '../config/logger.js';

const cache = new Map<string, { user: User | null; ts: number }>();
const CACHE_TTL = 60_000;
const SESION_TTL = 60 * 60_000;

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

function estaVencido(context: any, now: number): boolean {
  if (!context?._lastActivity) return true;
  return (now - context._lastActivity) > SESION_TTL;
}

function necesitaLimpieza(user: SessionUser, now: number): boolean {
  if (user.registroCompleto) {
    return !!(user.context?.ticketPaso !== undefined && estaVencido(user.context, now));
  }
  return user.pasoRegistro > 0 && estaVencido(user.context, now);
}

async function limpiarSesionVencida(telefono: string, user: User) {
  const yaRegistrado = user.get('registroCompleto') === true;
  if (!yaRegistrado) {
    user.set('nombreCompleto', null);
    user.set('email', null);
    user.set('registroCompleto', false);
  }
  user.set('pasoRegistro', 0);
  user.set('context', null);
  await user.save();
}

export async function obtenerUsuario(telefono: string): Promise<SessionUser> {
  const entry = cache.get(telefono);
  const now = Date.now();

  if (entry && (now - entry.ts) < CACHE_TTL) {
    return (entry.user ?? createDefault(telefono)) as SessionUser;
  }

  const user = await User.findByPk(telefono);
  if (!user) {
    const def = createDefault(telefono);
    cache.set(telefono, { user: null, ts: now });
    return def;
  }

  const sessionUser = user.get({ plain: true }) as unknown as SessionUser;

  if (necesitaLimpieza(sessionUser, now)) {
    await limpiarSesionVencida(telefono, user);
    sessionUser.pasoRegistro = 0;
    sessionUser.context = null;
    sessionUser.registroCompleto = false;
  }

  cache.set(telefono, { user: user as unknown as User | null, ts: now });
  return sessionUser;
}

export async function guardarUsuario(telefono: string, data: Partial<SessionUser>) {
  if (data.context !== undefined) {
    data.context = { ...data.context, _lastActivity: Date.now() };
    if (typeof (data.context as any).ticketPaso === 'number') {
      const parsed = TicketContextSchema.safeParse(data.context);
      if (!parsed.success && process.env.NODE_ENV !== 'production') {
        logger.warn({ errors: parsed.error.flatten() }, 'Context inválido');
      }
    }
  }

  if (data.email) {
    const existente = await User.findOne({ where: { email: data.email, telefono } });
    if (!existente) {
      const otro = await User.findOne({ where: { email: data.email } });
      if (otro) {
        logger.warn({ email: data.email, duplicado: otro.telefono, telefono }, 'Email duplicado');
        delete data.email;
      }
    }
  }

  const [user] = await User.upsert({
    telefono,
    ...data,
  } as any);
  cache.set(telefono, { user, ts: Date.now() });

  return user as unknown as SessionUser;
}

export async function guardarUltimosBotones(telefono: string, buttons: { id: string; title: string }[]) {
  const entry = cache.get(telefono);
  if (entry?.user) {
    const currentCtx = (entry.user as any).context || {};
    currentCtx._lastButtons = buttons;
    currentCtx._lastActivity = Date.now();
    User.update({ context: currentCtx }, { where: { telefono } }).catch(e => logger.error({ err: e?.message }, 'guardarUltimosBotones'));
    return;
  }

  const user = await User.findByPk(telefono);
  if (user) {
    const ctx = (user.context || {}) as any;
    ctx._lastButtons = buttons;
    ctx._lastActivity = Date.now();
    await User.update({ context: ctx }, { where: { telefono } });
    cache.set(telefono, { user: user as unknown as User | null, ts: Date.now() });
  }
}

export async function registrarMensajeEntrante(telefono: string, texto: string, ticketId?: number | null) {
  guardarMensaje(telefono, texto, 'inbound', ticketId);
}

export async function registrarMensajeSaliente(telefono: string, texto: string, ticketId?: number | null) {
  guardarMensaje(telefono, texto, 'outbound', ticketId);
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
