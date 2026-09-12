/**
 * Setup compartido de los tests de integración.
 *
 * - Resuelve contra qué DB correr (TEST_DATABASE_URL, o DATABASE_URL con sufijo _test)
 *   y la deja en DATABASE_URL ANTES de que se importe `config/database.ts`.
 * - Por seguridad aborta si el nombre de la DB no termina en `_test`
 *   (los tests hacen sync({ force: true }), o sea que borran todo).
 * - Expone helpers para crear datos de prueba y armar requests autenticados.
 *
 * Correr con: npm run test:integration
 *   - dentro del contenedor api: DATABASE_URL (host `db`) ya sirve
 *   - desde el host: TEST_DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/dgcatra_test
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';

// --- 1. Resolver la URL de la DB de tests y pisar DATABASE_URL -----------------

function resolverUrlDeTest(): string {
  const explicita = process.env.TEST_DATABASE_URL?.trim();
  let url = explicita;

  if (!url) {
    const base = process.env.DATABASE_URL?.trim();
    if (!base) {
      throw new Error(
        'Falta TEST_DATABASE_URL (o DATABASE_URL): los tests de integración necesitan una DB Postgres.',
      );
    }
    const u = new URL(base);
    u.pathname = `/${u.pathname.replace(/^\//, '').replace(/_test$/, '')}_test`;
    url = u.toString();
  }

  const nombre = new URL(url).pathname.replace(/^\//, '');
  if (!nombre.endsWith('_test')) {
    throw new Error(
      `Por seguridad la DB de tests debe terminar en "_test" (recibido: "${nombre}"). ` +
      'Los tests hacen sync({ force: true }) y borrarían todo.',
    );
  }
  return url;
}

export const DB_TEST_URL = resolverUrlDeTest();
export const NOMBRE_DB_TEST = new URL(DB_TEST_URL).pathname.replace(/^\//, '');

process.env.DATABASE_URL = DB_TEST_URL;
process.env.JWT_SECRET ||= 'secreto-de-tests';
process.env.MASTER_CODE = process.env.TEST_MASTER_CODE || '445566'; // determinístico
process.env.PORT ||= '0';

// --- 2. Crear la DB si no existe y dejar el schema limpio ---------------------

async function crearDBsiNoExiste() {
  const { Sequelize } = await import('sequelize');
  const u = new URL(DB_TEST_URL);
  const nombre = u.pathname.replace(/^\//, '');
  u.pathname = '/postgres';

  const admin = new Sequelize(u.toString(), { dialect: 'postgres', logging: false });
  try {
    await admin.query(`CREATE DATABASE "${nombre}"`);
  } catch (e: any) {
    if (e?.original?.code !== '42P04') throw e; // 42P04 = duplicate_database
  } finally {
    await admin.close();
  }
}

/** Crea la DB (si falta), recrea el schema y carga los settings. Llamar en beforeAll. */
export async function prepararDB() {
  try {
    await crearDBsiNoExiste();
  } catch (e: any) {
    throw new Error(
      `No se pudo conectar a Postgres para crear "${NOMBRE_DB_TEST}" (${DB_TEST_URL}). ` +
      `¿Está levantada la DB? Detalle: ${e?.message}`,
    );
  }

  const { sequelize } = await import('../../config/database.js');
  await import('../../models/models.js');
  await sequelize.sync({ force: true });

  const { initSettings } = await import('../../config/settings.js');
  initSettings();
}

export async function cerrarDB() {
  const { sequelize } = await import('../../config/database.js');
  await sequelize.close();
}

/** Vacía las tablas de datos entre tests (sin recrear el schema). */
export async function limpiarTablas() {
  const { sequelize } = await import('../../config/database.js');
  await sequelize.query('TRUNCATE TABLE tickets, usuarios, bases, conversaciones, settings RESTART IDENTITY CASCADE');
  const { initSettings } = await import('../../config/settings.js');
  initSettings();
}

// --- 3. App + helpers de datos ------------------------------------------------

export async function crearAppDeTest(): Promise<Express> {
  const { createApp } = await import('../../api/app.js');
  return createApp();
}

export const TELEFONOS = {
  usuario: '5491100000001',
  usuario2: '5491100000002',
  tecnico1: '5491100000003',
  tecnico2: '5491100000004',
  inactivo: '5491100000005',
  adminSinConfirmar: '5491100000006',
};

interface DatosUsuario {
  telefono: string;
  nombreCompleto?: string | null;
  esAdmin?: boolean;
  activo?: boolean;
  confirmadoWhatsApp?: boolean;
  registroCompleto?: boolean;
  baseId?: number | null;
  email?: string | null;
}

export async function crearUsuario(datos: DatosUsuario) {
  const { User } = await import('../../models/models.js');
  return User.create({
    telefono: datos.telefono,
    nombreCompleto: datos.nombreCompleto ?? 'Usuario Test',
    esAdmin: datos.esAdmin ?? false,
    activo: datos.activo ?? true,
    confirmadoWhatsApp: datos.confirmadoWhatsApp ?? true,
    registroCompleto: datos.registroCompleto ?? true,
    baseId: datos.baseId ?? null,
    email: datos.email ?? null,
    pasoRegistro: 0,
  } as any);
}

export async function crearBaseTest(nombre = 'Base Test', direccion = 'Av. Test 123') {
  const { Base } = await import('../../models/models.js');
  return Base.create({ nombre, direccion, tipo: 'base' });
}

export async function crearTicketTest(opciones: {
  userTelefono: string;
  baseId: number;
  asunto?: string;
  descripcion?: string;
  ubicacion?: string;
  estado?: 'abierto' | 'en_proceso' | 'cerrado';
  tecnicoTelefono?: string | null;
  tecnicoAsignado?: string | null;
}) {
  const { Ticket } = await import('../../models/models.js');
  return Ticket.create({
    asunto: opciones.asunto ?? 'Ticket de prueba',
    descripcion: opciones.descripcion ?? 'Descripción de prueba',
    ubicacion: opciones.ubicacion ?? 'Oficina 1',
    baseId: opciones.baseId,
    userTelefono: opciones.userTelefono,
    estado: opciones.estado ?? 'abierto',
    prioridad: 'media',
    tecnicoTelefono: opciones.tecnicoTelefono ?? null,
    tecnicoAsignado: opciones.tecnicoAsignado ?? null,
    historial: [],
    comentarios: [],
  } as any);
}

// --- 4. Auth de prueba --------------------------------------------------------

export interface OpcionesToken {
  esAdmin?: boolean;
  superAdmin?: boolean;
  nombre?: string;
}

export function crearToken(telefono: string, opciones: OpcionesToken = {}): string {
  return jwt.sign(
    {
      telefono,
      esAdmin: opciones.esAdmin ?? false,
      superAdmin: opciones.superAdmin,
      nombre: opciones.nombre ?? 'Usuario Test',
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

/** Headers listos para supertest: token + IP propia (aísla los rate limiters por test). */
export function headers(telefono: string, opciones: OpcionesToken = {}, ipNro = 1) {
  return {
    Authorization: `Bearer ${crearToken(telefono, opciones)}`,
    'X-Forwarded-For': `10.9.0.${ipNro}`,
  };
}

export function ipHeaders(ipNro: number) {
  return { 'X-Forwarded-For': `10.9.0.${ipNro}` };
}

export { request };
