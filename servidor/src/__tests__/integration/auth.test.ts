/**
 * Tests de integración de auth (punto #1 del reporte):
 * OTP por WhatsApp, código maestro, soft-delete (usuario desactivado) y bloqueo.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';
import {
  prepararDB,
  cerrarDB,
  limpiarTablas,
  crearAppDeTest,
  crearUsuario,
  TELEFONOS,
  request,
} from './setup.js';

// --- Mock del envío por WhatsApp: no queremos puppeteer en los tests ---
const mock = vi.hoisted(() => ({
  enviados: [] as { telefono: string; texto: string }[],
  falla: false,
}));

vi.mock('../../bot/enviar.js', () => ({
  enviarTexto: async (telefono: string, texto: string) => {
    if (mock.falla) return false;
    mock.enviados.push({ telefono, texto });
    return true;
  },
  enviarBotones: async () => true,
  enviarLista: async () => true,
  iniciarTyping: async () => {},
  setClient: () => {},
  registrarChatId: () => {},
}));

let app: Express;
let setBotConnected: () => void;
let setBotDisconnected: () => void;

/** Código OTP que "llegó" por WhatsApp (el texto es "...Tu código es: *123456*..."). */
function ultimoCodigo(): string {
  const ultimo = mock.enviados.at(-1);
  expect(ultimo, 'no se envió ningún código por WhatsApp').toBeTruthy();
  const m = ultimo!.texto.match(/Tu código es: \*(\d{6})\*/);
  expect(m, `texto inesperado: ${ultimo!.texto}`).toBeTruthy();
  return m![1];
}

/** IP propia por test: los rate limiters cuentan por IP y no queremos interferencias. */
function ip(n: number) {
  return { 'X-Forwarded-For': `10.9.1.${n}` };
}

beforeAll(async () => {
  await prepararDB();
  app = await crearAppDeTest();
  const socket = await import('../../socket/server.js');
  setBotConnected = () => socket.setBotConnected('5491126259181');
  setBotDisconnected = () => socket.setBotDisconnected();
  setBotConnected();
});

afterAll(async () => {
  await cerrarDB();
});

beforeEach(async () => {
  await limpiarTablas();
  mock.enviados.length = 0;
  mock.falla = false;
  setBotConnected();
});

describe('POST /api/auth/solicitar-codigo', () => {
  it('rechaza sin teléfono (400)', async () => {
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(1)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ID requerido/i);
  });

  it('devuelve 503 si el bot de WhatsApp está desconectado', async () => {
    setBotDisconnected();
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(2)).send({ telefono: TELEFONOS.usuario });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/desconectado/i);
  });

  it('devuelve 404 si el usuario no está registrado', async () => {
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(3)).send({ telefono: '5491199999999' });
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el usuario fue dado de baja (soft-delete)', async () => {
    // Al hacer soft-delete queda registroCompleto=false -> el bot debe pedir re-registro
    await crearUsuario({ telefono: TELEFONOS.inactivo, activo: false, registroCompleto: false });
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(4)).send({ telefono: TELEFONOS.inactivo });
    expect(res.status).toBe(404);
    expect(mock.enviados).toHaveLength(0);
  });

  it('devuelve 403 si el usuario está desactivado pero con registro completo', async () => {
    await crearUsuario({ telefono: TELEFONOS.inactivo, activo: false, registroCompleto: true });
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(5)).send({ telefono: TELEFONOS.inactivo });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/desactivado/i);
  });

  it('devuelve 403 si es admin y no confirmó su número por WhatsApp', async () => {
    await crearUsuario({ telefono: TELEFONOS.adminSinConfirmar, esAdmin: true, confirmadoWhatsApp: false });
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(6)).send({ telefono: TELEFONOS.adminSinConfirmar });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/confirmar/i);
  });

  it('devuelve 503 y descarta el código si falla el envío', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });
    mock.falla = true;
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(7)).send({ telefono: TELEFONOS.usuario });
    expect(res.status).toBe(503);
    // El código se descartó: aunque lo adivinemos, no sirve
    const verif = await request(app).post('/api/auth/verificar-codigo').set(ip(7)).send({ telefono: TELEFONOS.usuario, codigo: '123456' });
    expect(verif.status).toBe(401);
  });

  it('envía un OTP de 6 dígitos por WhatsApp', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario, nombreCompleto: 'Ale Candia' });
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ip(8)).send({ telefono: TELEFONOS.usuario });
    expect(res.status).toBe(200);
    expect(mock.enviados).toHaveLength(1);
    expect(mock.enviados[0].telefono).toBe(TELEFONOS.usuario);
    expect(ultimoCodigo()).toMatch(/^\d{6}$/);
  });
});

describe('POST /api/auth/solicitar-codigo (anti duplicados)', () => {
  it('no reenvía el OTP si se pide dos veces seguidas (429)', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });

    const primero = await request(app).post('/api/auth/solicitar-codigo').set(ip(21)).send({ telefono: TELEFONOS.usuario });
    expect(primero.status).toBe(200);
    expect(mock.enviados).toHaveLength(1);

    // Doble click: el segundo pedido NO genera un nuevo código ni otro WhatsApp
    const segundo = await request(app).post('/api/auth/solicitar-codigo').set(ip(21)).send({ telefono: TELEFONOS.usuario });
    expect(segundo.status).toBe(429);
    expect(segundo.body.error).toMatch(/esperá/i);
    expect(mock.enviados).toHaveLength(1);
  });

  it('el cooldown es por teléfono: otro número sí puede pedir su código', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });
    await crearUsuario({ telefono: TELEFONOS.usuario2 });

    await request(app).post('/api/auth/solicitar-codigo').set(ip(22)).send({ telefono: TELEFONOS.usuario });
    const otro = await request(app).post('/api/auth/solicitar-codigo').set(ip(22)).send({ telefono: TELEFONOS.usuario2 });

    expect(otro.status).toBe(200);
    expect(mock.enviados).toHaveLength(2);
  });

  it('el OTP del primer envío sigue siendo válido tras el intento bloqueado', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });

    await request(app).post('/api/auth/solicitar-codigo').set(ip(23)).send({ telefono: TELEFONOS.usuario });
    const codigo = ultimoCodigo();
    await request(app).post('/api/auth/solicitar-codigo').set(ip(23)).send({ telefono: TELEFONOS.usuario });

    const res = await request(app).post('/api/auth/verificar-codigo').set(ip(23)).send({ telefono: TELEFONOS.usuario, codigo });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/verificar-codigo', () => {
  it('rechaza sin teléfono o sin código (400)', async () => {
    const res = await request(app).post('/api/auth/verificar-codigo').set(ip(9)).send({ telefono: TELEFONOS.usuario });
    expect(res.status).toBe(400);
  });

  it('rechaza un código inválido (401)', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });
    await request(app).post('/api/auth/solicitar-codigo').set(ip(10)).send({ telefono: TELEFONOS.usuario });
    const res = await request(app).post('/api/auth/verificar-codigo').set(ip(10)).send({ telefono: TELEFONOS.usuario, codigo: '000000' });
    expect(res.status).toBe(401);
  });

  it('acepta el OTP enviado y devuelve token (flujo completo de login)', async () => {
    await crearUsuario({ telefono: TELEFONOS.tecnico1, nombreCompleto: 'Juan Perez', esAdmin: true });
    await request(app).post('/api/auth/solicitar-codigo').set(ip(11)).send({ telefono: TELEFONOS.tecnico1 });

    const res = await request(app).post('/api/auth/verificar-codigo').set(ip(11)).send({ telefono: TELEFONOS.tecnico1, codigo: ultimoCodigo() });
    expect(res.status).toBe(200);
    expect(res.body.esAdmin).toBe(true);
    expect(res.body.superAdmin).toBe(false);
    expect(res.body.nombre).toBe('Juan Perez');
    expect(typeof res.body.token).toBe('string');
  });

  it('el OTP es de un solo uso (el segundo intento falla)', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });
    await request(app).post('/api/auth/solicitar-codigo').set(ip(12)).send({ telefono: TELEFONOS.usuario });
    const codigo = ultimoCodigo();

    const primero = await request(app).post('/api/auth/verificar-codigo').set(ip(12)).send({ telefono: TELEFONOS.usuario, codigo });
    expect(primero.status).toBe(200);

    const segundo = await request(app).post('/api/auth/verificar-codigo').set(ip(12)).send({ telefono: TELEFONOS.usuario, codigo });
    expect(segundo.status).toBe(401);
  });

  it('rechaza el login si el usuario fue dado de baja entre el envío y la verificación (403)', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario });
    await request(app).post('/api/auth/solicitar-codigo').set(ip(13)).send({ telefono: TELEFONOS.usuario });
    const codigo = ultimoCodigo();

    const { User } = await import('../../models/models.js');
    await User.update({ activo: false }, { where: { telefono: TELEFONOS.usuario } });

    const res = await request(app).post('/api/auth/verificar-codigo').set(ip(13)).send({ telefono: TELEFONOS.usuario, codigo });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/desactivado/i);
  });

  it('acepta el código maestro como superAdmin sin pasar por WhatsApp', async () => {
    const res = await request(app)
      .post('/api/auth/verificar-codigo')
      .set(ip(14))
      .send({ telefono: TELEFONOS.usuario, codigo: process.env.MASTER_CODE });

    expect(res.status).toBe(200);
    expect(res.body.superAdmin).toBe(true);
    expect(res.body.esAdmin).toBe(true);
    expect(mock.enviados).toHaveLength(0);
  });

  it('rechaza un código maestro incorrecto (401)', async () => {
    const res = await request(app).post('/api/auth/verificar-codigo').set(ip(15)).send({ telefono: TELEFONOS.usuario, codigo: '000000' });
    expect(res.status).toBe(401);
  });
});

describe('Middleware de auth (bloqueo de usuarios dados de baja)', () => {
  it('rechaza sin token (401)', async () => {
    const res = await request(app).get('/api/usuarios').set(ip(16));
    expect(res.status).toBe(401);
  });

  it('rechaza un token inválido (401)', async () => {
    const res = await request(app).get('/api/usuarios').set(ip(17)).set('Authorization', 'Bearer no-es-un-token');
    expect(res.status).toBe(401);
  });

  it('rechaza el token de un usuario desactivado (401)', async () => {
    await crearUsuario({ telefono: TELEFONOS.usuario, esAdmin: true });
    const { crearToken } = await import('./setup.js');
    const token = crearToken(TELEFONOS.usuario, { esAdmin: true });

    // Antes de la baja el token sirve
    const ok = await request(app).get('/api/usuarios').set(ip(18)).set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);

    // Soft-delete y el token deja de valer al instante (se consulta la DB, no una blacklist)
    const { User } = await import('../../models/models.js');
    await User.update({ activo: false }, { where: { telefono: TELEFONOS.usuario } });

    const trasBaja = await request(app).get('/api/usuarios').set(ip(19)).set('Authorization', `Bearer ${token}`);
    expect(trasBaja.status).toBe(401);
    expect(trasBaja.body.error).toMatch(/desactivado/i);
  });

  it('acepta el token del código maestro (superAdmin) sin usuario en la DB', async () => {
    const { crearToken } = await import('./setup.js');
    const token = crearToken('5491100099999', { esAdmin: true, superAdmin: true, nombre: 'Admin' });
    const res = await request(app).get('/api/usuarios').set(ip(20)).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
