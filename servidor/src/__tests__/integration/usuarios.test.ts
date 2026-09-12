/**
 * Tests de integración de usuarios (punto #1 del reporte):
 * soft-delete (baja que conserva historial), bloqueo de acceso y alta de administradores.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';
import {
  prepararDB,
  cerrarDB,
  limpiarTablas,
  crearAppDeTest,
  crearUsuario,
  crearBaseTest,
  crearTicketTest,
  headers,
  ipHeaders,
  TELEFONOS,
  request,
} from './setup.js';

const mock = vi.hoisted(() => ({ enviados: [] as string[] }));

vi.mock('../../bot/enviar.js', () => ({
  enviarTexto: async (_t: string, texto: string) => {
    mock.enviados.push(texto);
    return true;
  },
  enviarBotones: async () => true,
  enviarLista: async () => true,
  iniciarTyping: async () => {},
  setClient: () => {},
  registrarChatId: () => {},
}));

let app: Express;
let baseId: number;
const superAdmin = { telefono: '5491100000009', esAdmin: true, superAdmin: true, nombre: 'Super Admin' };

const authSuper = () => headers(superAdmin.telefono, { esAdmin: true, superAdmin: true, nombre: 'Super Admin' });
const authAdmin = (tel = TELEFONOS.tecnico1) => headers(tel, { esAdmin: true, nombre: 'Juan Perez' });

beforeAll(async () => {
  await prepararDB();
  app = await crearAppDeTest();
});

afterAll(async () => {
  await cerrarDB();
});

beforeEach(async () => {
  await limpiarTablas();
  mock.enviados.length = 0;
  // El bot tiene que estar "conectado" para que solicitar-codigo no devuelva 503
  const { setBotConnected } = await import('../../socket/server.js');
  setBotConnected('5491126259181');
  const base = await crearBaseTest('Base Piedras');
  baseId = base.id;
  await crearUsuario({ telefono: TELEFONOS.usuario, nombreCompleto: 'Ale Candia', baseId });
  await crearUsuario({ telefono: TELEFONOS.tecnico1, nombreCompleto: 'Juan Perez', esAdmin: true, baseId });
});

describe('DELETE /api/usuarios/:telefono (soft-delete)', () => {
  it('requiere ser admin (403)', async () => {
    const res = await request(app).delete(`/api/usuarios/${TELEFONOS.usuario}`).set(headers(TELEFONOS.usuario));
    expect(res.status).toBe(403);
  });

  it('da de baja al usuario sin borrarlo de la DB', async () => {
    const res = await request(app).delete(`/api/usuarios/${TELEFONOS.usuario}`).set(authSuper());
    expect(res.status).toBe(200);

    const { User } = await import('../../models/models.js');
    const user = await User.findByPk(TELEFONOS.usuario);
    expect(user).toBeTruthy();
    expect(user!.activo).toBe(false);
    expect(user!.registroCompleto).toBe(false);
    expect(user!.esAdmin).toBe(false);
    // El nombre se conserva para poder mostrar el historial
    expect(user!.nombreCompleto).toBe('Ale Candia');
  });

  it('conserva los tickets y el historial del usuario dado de baja', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, asunto: 'Historial que debe sobrevivir' });
    await request(app).delete(`/api/usuarios/${TELEFONOS.usuario}`).set(authSuper());

    const { Ticket } = await import('../../models/models.js');
    const sigue = await Ticket.findByPk(ticket.id);
    expect(sigue).toBeTruthy();
    expect(sigue!.asunto).toBe('Historial que debe sobrevivir');

    // Y el dashboard lo sigue listando
    const lista = await request(app).get('/api/tickets').set(authSuper());
    expect(lista.body.total).toBe(1);
  });

  it('bloquea el acceso del usuario dado de baja: no puede pedir OTP ni usar su token viejo', async () => {
    const tokenViejo = headers(TELEFONOS.usuario).Authorization;
    const { User } = await import('../../models/models.js');

    await request(app).delete(`/api/usuarios/${TELEFONOS.usuario}`).set(authSuper());
    await User.update({ registroCompleto: false }, { where: { telefono: TELEFONOS.usuario } });

    // 1. No puede pedir un nuevo código
    const otp = await request(app).post('/api/auth/solicitar-codigo').set(ipHeaders(40)).send({ telefono: TELEFONOS.usuario });
    expect(otp.status).toBe(404);
    expect(mock.enviados).toHaveLength(0);

    // 2. Su token anterior deja de servir
    const conToken = await request(app).get('/api/tickets').set(ipHeaders(41)).set('Authorization', tokenViejo);
    expect(conToken.status).toBe(401);
    expect(conToken.body.error).toMatch(/desactivado/i);
  });

  it('permite re-registrarse después de la baja (el teléfono queda libre)', async () => {
    await request(app).delete(`/api/usuarios/${TELEFONOS.usuario}`).set(authSuper());

    const { User } = await import('../../models/models.js');
    await User.update({ registroCompleto: true, activo: true, pasoRegistro: 0 }, { where: { telefono: TELEFONOS.usuario } });

    const res = await request(app).post('/api/auth/solicitar-codigo').set(ipHeaders(42)).send({ telefono: TELEFONOS.usuario });
    expect(res.status).toBe(200);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await request(app).delete('/api/usuarios/5491188888888').set(authSuper());
    expect(res.status).toBe(404);
  });
});

describe('GET /api/usuarios', () => {
  it('lista y filtra por inactivos', async () => {
    await request(app).delete(`/api/usuarios/${TELEFONOS.usuario}`).set(authSuper());

    const activos = await request(app).get('/api/usuarios?inactivo=false').set(authSuper());
    expect(activos.status).toBe(200);
    expect(activos.body.data.map((u: any) => u.telefono)).not.toContain(TELEFONOS.usuario);

    const inactivos = await request(app).get('/api/usuarios?inactivo=true').set(authSuper());
    expect(inactivos.body.data.map((u: any) => u.telefono)).toContain(TELEFONOS.usuario);
    expect(inactivos.body.data[0].activo).toBe(false);
  });

  it('devuelve un usuario puntual por teléfono', async () => {
    const res = await request(app).get(`/api/usuarios/${TELEFONOS.usuario}`).set(authSuper());
    expect(res.status).toBe(200);
    expect(res.body.nombreCompleto).toBe('Ale Candia');
  });
});

describe('POST /api/usuarios (alta de administradores)', () => {
  const nuevoAdmin = '5491100000007';

  it('solo el superAdmin puede crear administradores (403)', async () => {
    const res = await request(app).post('/api/usuarios').set(authAdmin()).send({ nombreCompleto: 'Nuevo Admin', telefono: nuevoAdmin });
    expect(res.status).toBe(403);
  });

  it('crea el admin con confirmadoWhatsApp=false y le manda el pedido de confirmación', async () => {
    const res = await request(app).post('/api/usuarios').set(authSuper()).send({ nombreCompleto: 'Nuevo Admin', telefono: nuevoAdmin });

    expect(res.status).toBe(201);
    expect(res.body.esAdmin).toBe(true);
    expect(res.body.confirmadoWhatsApp).toBe(false);
    expect(res.body.registroCompleto).toBe(true);
    expect(mock.enviados.some(t => /confirmar/i.test(t))).toBe(true);
  });

  it('no deja loguearse al admin hasta que confirme por WhatsApp (403 -> 200)', async () => {
    await request(app).post('/api/usuarios').set(authSuper()).send({ nombreCompleto: 'Nuevo Admin', telefono: nuevoAdmin });

    const sinConfirmar = await request(app).post('/api/auth/solicitar-codigo').set(ipHeaders(43)).send({ telefono: nuevoAdmin });
    expect(sinConfirmar.status).toBe(403);
    expect(sinConfirmar.body.error).toMatch(/confirmar/i);

    const { User } = await import('../../models/models.js');
    await User.update({ confirmadoWhatsApp: true }, { where: { telefono: nuevoAdmin } });

    const confirmado = await request(app).post('/api/auth/solicitar-codigo').set(ipHeaders(44)).send({ telefono: nuevoAdmin });
    expect(confirmado.status).toBe(200);
  });

  it('avisa si el usuario ya existe y exige confirmación para promoverlo (409)', async () => {
    const res = await request(app).post('/api/usuarios').set(authSuper()).send({ nombreCompleto: 'Ale Candia', telefono: TELEFONOS.usuario });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('usuario_existente');
  });

  it('promueve al usuario existente con forzarPromocion', async () => {
    const res = await request(app).post('/api/usuarios').set(authSuper()).send({ nombreCompleto: 'Ale Candia', telefono: TELEFONOS.usuario, forzarPromocion: true });
    expect(res.status).toBe(201);
    expect(res.body.esAdmin).toBe(true);
    expect(res.body.confirmadoWhatsApp).toBe(false);
  });

  it('valida el formato del teléfono (400)', async () => {
    const res = await request(app).post('/api/usuarios').set(authSuper()).send({ nombreCompleto: 'Malo', telefono: 'no-es-un-tel' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/usuarios/:telefono', () => {
  it('permite a un admin editar datos del usuario', async () => {
    const res = await request(app)
      .patch(`/api/usuarios/${TELEFONOS.usuario}`)
      .set(authAdmin())
      .send({ nombreCompleto: 'Ale Candia Editado', email: 'ale@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.nombreCompleto).toBe('Ale Candia Editado');
    expect(res.body.email).toBe('ale@example.com');
  });

  it('un usuario común no puede editar (403)', async () => {
    const res = await request(app).patch(`/api/usuarios/${TELEFONOS.usuario}`).set(headers(TELEFONOS.usuario)).send({ nombreCompleto: 'Hack' });
    expect(res.status).toBe(403);
  });
});
