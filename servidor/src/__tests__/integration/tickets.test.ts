/**
 * Tests de integración de tickets (punto #1 del reporte):
 * creación de tickets, permisos y regresión del #4 (técnico asignado por teléfono,
 * dos técnicos homónimos no se pisan).
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

vi.mock('../../bot/enviar.js', () => ({
  enviarTexto: async () => true,
  enviarBotones: async () => true,
  enviarLista: async () => true,
  iniciarTyping: async () => {},
  setClient: () => {},
  registrarChatId: () => {},
}));

let app: Express;
let baseId: number;
const superAdmin = { telefono: '5491100000009', esAdmin: true, superAdmin: true, nombre: 'Super Admin' };
const adminJuan1 = { telefono: TELEFONOS.tecnico1, esAdmin: true, nombre: 'Juan Perez' };
const adminJuan2 = { telefono: TELEFONOS.tecnico2, esAdmin: true, nombre: 'Juan Perez' };

beforeAll(async () => {
  await prepararDB();
  app = await crearAppDeTest();
});

afterAll(async () => {
  await cerrarDB();
});

beforeEach(async () => {
  await limpiarTablas();
  const base = await crearBaseTest('Base Piedras');
  baseId = base.id;
  await crearUsuario({ telefono: TELEFONOS.usuario, nombreCompleto: 'Ale Candia', baseId });
  await crearUsuario({ telefono: adminJuan1.telefono, nombreCompleto: 'Juan Perez', esAdmin: true });
  await crearUsuario({ telefono: adminJuan2.telefono, nombreCompleto: 'Juan Perez', esAdmin: true });
});

describe('POST /api/tickets (creación)', () => {
  it('requiere token (401)', async () => {
    const res = await request(app).post('/api/tickets').send({ asunto: 'x', descripcion: 'x', ubicacion: 'x', baseId });
    expect(res.status).toBe(401);
  });

  it('crea el ticket con estado abierto, prioridad media y el usuario del token', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set(headers(TELEFONOS.usuario, { nombre: 'Ale Candia' }))
      .send({ asunto: 'PC no enciende', descripcion: 'No da imagen', ubicacion: 'Oficina 3', baseId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      asunto: 'PC no enciende',
      estado: 'abierto',
      prioridad: 'media',
      userTelefono: TELEFONOS.usuario,
      tecnicoTelefono: null,
      tecnicoAsignado: null,
    });
    expect(res.body.usuario.nombreCompleto).toBe('Ale Candia');
    expect(res.body.base.nombre).toBe('Base Piedras');
  });

  it('valida los campos requeridos (400)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set(headers(TELEFONOS.usuario))
      .send({ asunto: 'Falta ubicacion', descripcion: 'x', baseId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ubicacion/i);
  });
});

describe('PATCH /api/tickets/:id (asignación de técnico por teléfono)', () => {
  it('rechaza a un usuario que no es admin (403)', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(TELEFONOS.usuario))
      .send({ estado: 'en_proceso' });

    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el ticket no existe', async () => {
    const res = await request(app).patch('/api/tickets/999999').set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true })).send({ estado: 'en_proceso' });
    expect(res.status).toBe(404);
  });

  it('asigna el técnico por teléfono y sincroniza el nombre para mostrar', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true, nombre: 'Super Admin' }))
      .send({ tecnicoTelefono: TELEFONOS.tecnico2, estado: 'en_proceso' });

    expect(res.status).toBe(200);
    expect(res.body.tecnicoTelefono).toBe(TELEFONOS.tecnico2);
    expect(res.body.tecnicoAsignado).toBe('Juan Perez');
    expect(res.body.tecnico.telefono).toBe(TELEFONOS.tecnico2);
    expect(res.body.historial.some((h: any) => /se asignó como técnico/.test(h.accion))).toBe(true);
  });

  it('con dos técnicos homónimos asigna al del teléfono indicado (no al otro)', async () => {
    const ticketA = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, asunto: 'Ticket A' });
    const ticketB = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, asunto: 'Ticket B' });
    const auth = headers(superAdmin.telefono, { esAdmin: true, superAdmin: true });

    await request(app).patch(`/api/tickets/${ticketA.id}`).set(auth).send({ tecnicoTelefono: TELEFONOS.tecnico1, estado: 'en_proceso' });
    await request(app).patch(`/api/tickets/${ticketB.id}`).set(auth).send({ tecnicoTelefono: TELEFONOS.tecnico2, estado: 'en_proceso' });

    // Filtro por teléfono: cada técnico ve SOLO su ticket, aunque compartan nombre
    const deJuan1 = await request(app).get(`/api/tickets?tecnicoTelefono=${TELEFONOS.tecnico1}`).set(auth);
    expect(deJuan1.body.total).toBe(1);
    expect(deJuan1.body.data[0].asunto).toBe('Ticket A');
    expect(deJuan1.body.data[0].tecnicoTelefono).toBe(TELEFONOS.tecnico1);

    const deJuan2 = await request(app).get(`/api/tickets?tecnicoTelefono=${TELEFONOS.tecnico2}`).set(auth);
    expect(deJuan2.body.total).toBe(1);
    expect(deJuan2.body.data[0].asunto).toBe('Ticket B');
    expect(deJuan2.body.data[0].tecnicoTelefono).toBe(TELEFONOS.tecnico2);
  });

  it('rechaza un técnico inexistente (400)', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true }))
      .send({ tecnicoTelefono: '5491100099999' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Técnico inválido/i);
  });

  it('rechaza asignar a un usuario que no es admin (400)', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true }))
      .send({ tecnicoTelefono: TELEFONOS.usuario });

    expect(res.status).toBe(400);
  });

  it('un admin común no puede reasignar el ticket a otro técnico (403)', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, tecnicoTelefono: TELEFONOS.tecnico1, tecnicoAsignado: 'Juan Perez', estado: 'en_proceso' });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(adminJuan1.telefono, { esAdmin: true, nombre: 'Juan Perez' }))
      .send({ tecnicoTelefono: TELEFONOS.tecnico2 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/reasignar/i);
  });

  it('un admin común puede auto-asignarse un ticket sin técnico', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(adminJuan2.telefono, { esAdmin: true, nombre: 'Juan Perez' }))
      .send({ tecnicoTelefono: adminJuan2.telefono, estado: 'en_proceso' });

    expect(res.status).toBe(200);
    expect(res.body.tecnicoTelefono).toBe(TELEFONOS.tecnico2);
  });

  it('el técnico asignado puede dejar el caso: se desasigna y vuelve a abierto', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, tecnicoTelefono: TELEFONOS.tecnico1, tecnicoAsignado: 'Juan Perez', estado: 'en_proceso' });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(adminJuan1.telefono, { esAdmin: true, nombre: 'Juan Perez' }))
      .send({ tecnicoTelefono: null, estado: 'abierto' });

    expect(res.status).toBe(200);
    expect(res.body.tecnicoTelefono).toBeNull();
    expect(res.body.estado).toBe('abierto');
    expect(res.body.historial.some((h: any) => /se desvinculó/.test(h.accion))).toBe(true);
  });

  it('solo el superAdmin puede cambiar la prioridad (403 y 200)', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });

    const negado = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(adminJuan1.telefono, { esAdmin: true, nombre: 'Juan Perez' }))
      .send({ prioridad: 'alta' });
    expect(negado.status).toBe(403);

    const ok = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true }))
      .send({ prioridad: 'alta' });
    expect(ok.status).toBe(200);
    expect(ok.body.prioridad).toBe('alta');
  });

  it('acepta el nombre del técnico por compatibilidad (tecnicoAsignado legacy)', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true }))
      .send({ tecnicoAsignado: 'Juan Perez' });

    expect(res.status).toBe(200);
    // El nombre se resuelve al teléfono del primer técnico homónimo que exista
    expect([TELEFONOS.tecnico1, TELEFONOS.tecnico2]).toContain(res.body.tecnicoTelefono);
  });

  it('registra en el historial el cierre del ticket', async () => {
    const ticket = await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, tecnicoTelefono: TELEFONOS.tecnico1, tecnicoAsignado: 'Juan Perez', estado: 'en_proceso' });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(headers(adminJuan1.telefono, { esAdmin: true, nombre: 'Juan Perez' }))
      .send({ estado: 'cerrado', solucion: 'Se cambió la fuente' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('cerrado');
    expect(res.body.solucion).toBe('Se cambió la fuente');
    expect(res.body.historial.length).toBeGreaterThan(0);
  });
});

describe('GET /api/tickets (filtros)', () => {
  it('filtra los tickets sin técnico asignado', async () => {
    await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, asunto: 'Sin técnico' });
    await crearTicketTest({ userTelefono: TELEFONOS.usuario, baseId, asunto: 'Con técnico', tecnicoTelefono: TELEFONOS.tecnico1, tecnicoAsignado: 'Juan Perez', estado: 'en_proceso' });

    const res = await request(app)
      .get('/api/tickets?sinAsignar=true')
      .set(headers(superAdmin.telefono, { esAdmin: true, superAdmin: true }));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].asunto).toBe('Sin técnico');
  });

  it('requiere token (401)', async () => {
    const res = await request(app).get('/api/tickets').set(ipHeaders(30));
    expect(res.status).toBe(401);
  });
});
