/**
 * Tests de integración de la consolidación de usuarios con LID (migración de datos).
 * Es la parte más delicada del fix: mover tickets y conversaciones sin perder historial.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prepararDB, cerrarDB, limpiarTablas, crearUsuario, crearBaseTest, crearTicketTest } from './setup.js';
import { migrarUsuarioDeLid, resetearCacheMigracion } from '../../bot/migrar-lid.js';

const LID = '30262373163147'; // dígitos del LID que había guardado el bot
const TEL = '5491166086509'; // teléfono real al que se resuelve
const LID_CHAT = `${LID}@lid`;

beforeAll(async () => {
  await prepararDB();
});

afterAll(async () => {
  await cerrarDB();
});

beforeEach(async () => {
  await limpiarTablas();
  resetearCacheMigracion();
});

describe('migrarUsuarioDeLid', () => {
  it('consolida la fila del LID en el teléfono real, moviendo tickets y conversaciones', async () => {
    const { User, Conversacion } = await import('../../models/models.js');
    const base = await crearBaseTest();
    const viejo = await crearUsuario({ telefono: LID, nombreCompleto: 'Ale Candia', baseId: base.id });
    await User.update({ chatId: LID_CHAT }, { where: { telefono: LID } });
    await crearTicketTest({ userTelefono: LID, baseId: base.id, asunto: 'Ticket creado con LID' });
    await Conversacion.create({ userTelefono: LID, mensaje: 'hola', direccion: 'inbound' } as any);

    const migrado = await migrarUsuarioDeLid(LID, TEL);
    expect(migrado).toBe(true);

    // La fila vieja ya no existe y la nueva conserva nombre/base/chatId
    expect(await User.findByPk(LID)).toBeNull();
    const nuevo = await User.findByPk(TEL);
    expect(nuevo).toBeTruthy();
    expect(nuevo!.nombreCompleto).toBe('Ale Candia');
    expect(nuevo!.baseId).toBe(viejo.baseId);
    expect(nuevo!.chatId).toBe(LID_CHAT);

    // Los hijos se movieron (no se perdió nada)
    const { Ticket } = await import('../../models/models.js');
    const tickets = await Ticket.findAll({ where: { userTelefono: TEL } });
    expect(tickets).toHaveLength(1);
    expect(tickets[0].asunto).toBe('Ticket creado con LID');
    expect(await Conversacion.count({ where: { userTelefono: LID } })).toBe(0);
    expect(await Conversacion.count({ where: { userTelefono: TEL } })).toBe(1);
  });

  it('si ya existe una fila con el teléfono real, mueve los hijos ahí y no duplica usuario', async () => {
    const { User, Conversacion } = await import('../../models/models.js');
    const base = await crearBaseTest();
    await crearUsuario({ telefono: LID, nombreCompleto: 'Ale Candia', baseId: base.id });
    await User.update({ chatId: LID_CHAT }, { where: { telefono: LID } });
    await crearTicketTest({ userTelefono: LID, baseId: base.id, asunto: 'Con LID' });
    // Fila creada a mano desde el panel (admin con el teléfono real)
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Ale Candia', esAdmin: true, confirmadoWhatsApp: true, baseId: base.id });
    await crearTicketTest({ userTelefono: TEL, baseId: base.id, asunto: 'Con teléfono' });
    await Conversacion.create({ userTelefono: LID, mensaje: 'historial viejo', direccion: 'inbound' } as any);

    const migrado = await migrarUsuarioDeLid(LID, TEL);
    expect(migrado).toBe(true);

    // La fila destino conserva sus permisos y recibe el chatId del LID
    const { Ticket } = await import('../../models/models.js');
    const usuarios = await (await import('../../models/models.js')).User.count();
    expect(usuarios).toBe(1);
    const destino = await User.findByPk(TEL);
    expect(destino!.esAdmin).toBe(true);
    expect(destino!.chatId).toBe(LID_CHAT);

    expect(await Ticket.count({ where: { userTelefono: TEL } })).toBe(2);
    expect(await Conversacion.count({ where: { userTelefono: TEL } })).toBe(1);
    expect(await User.findByPk(LID)).toBeNull();
  });

  it('también actualiza los tickets donde el LID era el técnico asignado', async () => {
    const base = await crearBaseTest();
    await crearUsuario({ telefono: LID, nombreCompleto: 'Juan Perez', esAdmin: true });
    await crearUsuario({ telefono: '5491100000001', nombreCompleto: 'Otro' });
    const ticket = await crearTicketTest({
      userTelefono: '5491100000001',
      baseId: base.id,
      estado: 'en_proceso',
      tecnicoTelefono: LID,
      tecnicoAsignado: 'Juan Perez',
    });

    await migrarUsuarioDeLid(LID, TEL);

    const { Ticket } = await import('../../models/models.js');
    const actualizado = await Ticket.findByPk(ticket.id);
    expect(actualizado!.tecnicoTelefono).toBe(TEL);
  });

  it('no hace nada si el LID no tiene fila propia', async () => {
    expect(await migrarUsuarioDeLid(LID, TEL)).toBe(false);
  });

  it('no hace nada si el LID y el teléfono son iguales', async () => {
    expect(await migrarUsuarioDeLid(TEL, TEL)).toBe(false);
  });

  it('es idempotente: la segunda llamada no vuelve a tocar la DB', async () => {
    await crearUsuario({ telefono: LID, nombreCompleto: 'Ale Candia' });

    expect(await migrarUsuarioDeLid(LID, TEL)).toBe(true);
    expect(await migrarUsuarioDeLid(LID, TEL)).toBe(false);
  });
});
