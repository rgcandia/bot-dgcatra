/**
 * Tests de integración del flujo de creación de tickets del bot (handler directo).
 *
 * Cubre el paso nuevo de "tipo de establecimiento":
 *   descripción → tipo (base/playa/comuna) → establecimiento filtrado por tipo
 *   → ubicación → confirmación → ticket.
 *
 * Se mockean `bot/enviar.js` (nada de puppeteer/WhatsApp) y `bot/groq.js`
 * (título determinístico, sin pegarle a la API).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prepararDB, cerrarDB, limpiarTablas, crearUsuario } from './setup.js';

const { mensajes } = vi.hoisted(() => ({ mensajes: [] as string[] }));

vi.mock('../../bot/enviar.js', () => ({
  enviarTexto: async (_t: string, texto: string) => { mensajes.push(texto); return true; },
  enviarBotones: async (_t: string, texto: string) => { mensajes.push(texto); return true; },
  enviarLista: async () => true,
  iniciarTyping: async () => {},
  setClient: () => {},
  registrarChatId: () => {},
  obtenerCliente: () => null,
}));

vi.mock('../../bot/groq.js', () => ({
  generarTituloTicket: async (descripcion: string) => `TITULO:${descripcion.substring(0, 20)}`,
}));

import { manejarCreacionTicket } from '../../bot/handlers/ticket.js';
import { invalidarCache } from '../../bot/session.js';

const TEL = '5491100000001';

async function crearBase(nombre: string, tipo: 'base' | 'playa' | 'comuna', direccion = 'Dir 123') {
  const { Base } = await import('../../models/models.js');
  return Base.create({ nombre, direccion, tipo } as any);
}

/** Ejecuta un turno del flujo y devuelve lo que el bot respondió. */
async function paso(texto: string, buttonId?: string): Promise<string> {
  mensajes.length = 0;
  await manejarCreacionTicket({ telefono: TEL, texto, buttonId });
  return mensajes.join('\n');
}

beforeAll(async () => {
  await prepararDB();
});

afterAll(async () => {
  await cerrarDB();
});

beforeEach(async () => {
  await limpiarTablas();
  invalidarCache(TEL);
  mensajes.length = 0;
});

describe('flujo de ticket con tipo de establecimiento', () => {
  it('pregunta el tipo, filtra el listado y crea el ticket con el establecimiento elegido', async () => {
    const base = await crearBase('Base Piedras', 'base');
    const playa = await crearBase('Playa Costanera', 'playa');
    await crearBase('Comuna 12', 'comuna');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    expect(await paso('crear')).toContain('¡Dale, Creemos un Ticket');

    const turnoTipo = await paso('La impresora no imprime');
    expect(turnoTipo).toContain('¿En qué tipo de establecimiento');
    expect(turnoTipo).toContain('1. Base');
    expect(turnoTipo).toContain('2. Playa');
    expect(turnoTipo).toContain('3. Comuna');

    const turnoLista = await paso('2');
    expect(turnoLista).toContain('Establecimientos de tipo Playa');
    expect(turnoLista).toContain('1. Playa Costanera');
    // No se filtran establecimientos de otros tipos
    expect(turnoLista).not.toContain('Base Piedras');
    expect(turnoLista).not.toContain('Comuna 12');

    expect(await paso('1')).toContain('¿En qué oficina, sector o puesto');

    const resumen = await paso('Oficina 3, primer piso');
    expect(resumen).toContain('Confirmá los datos');
    expect(resumen).toContain('Playa Costanera');
    expect(resumen).toContain('(Playa)');
    expect(resumen).toContain('Oficina 3, primer piso');

    const ok = await paso('SI');
    expect(ok).toContain('creado con éxito');

    const { Ticket } = await import('../../models/models.js');
    const creado = await Ticket.findOne({ where: { userTelefono: TEL } });
    expect(creado).toBeTruthy();
    expect(creado!.baseId).toBe(playa.id);
    expect(creado!.baseId).not.toBe(base.id);
    expect(creado!.estado).toBe('abierto');
    expect(creado!.ubicacion).toBe('Oficina 3, primer piso');
    expect(creado!.asunto).toContain('TITULO:');
  });

  it('acepta el nombre del tipo escrito por texto ("playa")', async () => {
    await crearBase('Base Piedras', 'base');
    await crearBase('Playa Salguero', 'playa');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');
    const turnoLista = await paso('playa');
    expect(turnoLista).toContain('Establecimientos de tipo Playa');
    expect(turnoLista).toContain('Playa Salguero');
  });

  it('rechaza una opción de tipo inválida y no avanza', async () => {
    await crearBase('Base Piedras', 'base');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');

    expect(await paso('9')).toContain('Opción inválida');
    expect(await paso('cualquier cosa')).toContain('Opción inválida');
  });

  it('no ofrece tipos que no tienen establecimientos cargados', async () => {
    await crearBase('Base Piedras', 'base');
    await crearBase('Playa Costanera', 'playa');
    // Sin comunas
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    const turno = await paso('No tengo internet');
    expect(turno).toContain('1. Base');
    expect(turno).toContain('2. Playa');
    expect(turno).not.toContain('Comuna');

    expect(await paso('3')).toContain('Opción inválida');
  });

  it('no deja colar un establecimiento de otro tipo (número fuera de la lista filtrada)', async () => {
    await crearBase('Base Piedras', 'base');
    await crearBase('Playa Costanera', 'playa');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');
    await paso('2'); // playa → lista con 1 solo ítem

    expect(await paso('5')).toContain('Opción inválida');

    // Tampoco por nombre de otro tipo
    expect(await paso('Base Piedras')).toContain('Opción inválida');

    // El válido sigue funcionando
    expect(await paso('1')).toContain('¿En qué oficina, sector o puesto');
  });

  it('rechaza un buttonId de otra categoría (lista vieja)', async () => {
    const base = await crearBase('Base Piedras', 'base');
    await crearBase('Playa Costanera', 'playa');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');
    await paso('2'); // elegimos playa

    expect(await paso('', `base_${base.id}`)).toContain('Opción inválida');
  });

  it('cancelar en cada paso limpia el contexto y no crea ticket', async () => {
    await crearBase('Base Piedras', 'base');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });
    const { Ticket } = await import('../../models/models.js');
    const { User } = await import('../../models/models.js');

    // `guardarUsuario({ context: null })` deja `{ _lastActivity }`: lo importante
    // es que no quede el `ticketPaso`, o sea que el flujo quedó reseteado.
    const sinPaso = async () => ((await User.findByPk(TEL))!.context as any)?.ticketPaso;

    // Cancelar en el paso de descripción
    await paso('crear');
    expect(await paso('cancelar')).toContain('Cancelado');
    expect(await sinPaso()).toBeUndefined();

    // Cancelar en el paso de tipo
    await paso('crear');
    await paso('No tengo internet');
    expect(await paso('cancelar')).toContain('Cancelado');
    expect(await sinPaso()).toBeUndefined();

    // Cancelar en el paso de establecimiento
    await paso('crear');
    await paso('No tengo internet');
    await paso('1');
    expect(await paso('cancelar')).toContain('Cancelado');
    expect(await sinPaso()).toBeUndefined();

    expect(await Ticket.count()).toBe(0);
  });

  it('no interpreta "9 de julio" como el índice 9 de la lista', async () => {
    // 9 playas "Playa X" + "9 de Julio" (10 en total): con el parseo viejo,
    // parseInt('9 de julio') === 9 elegía una playa en vez del establecimiento.
    for (const letra of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
      await crearBase(`Playa ${letra}`, 'playa');
    }
    await crearBase('9 de Julio', 'playa');
    // Una base para que el menú de tipos sea [1. Base, 2. Playa] y el "2" sea válido
    await crearBase('Base Piedras', 'base');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');
    await paso('2');

    expect(await paso('9 de julio')).toContain('¿En qué oficina, sector o puesto');
    const resumen = await paso('Oficina 1');
    expect(resumen).toContain('9 de Julio');
    expect(resumen).toContain('(Playa)');
    // Si hubiera matcheado la 9na de la lista, el establecimiento sería una "Playa X"
    expect(resumen).not.toContain('Playa ');
  });

  it('en el paso de tipo, una opción inválida vuelve a mostrar el menú', async () => {
    await crearBase('Base Piedras', 'base');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');

    const respuesta = await paso('9');
    expect(respuesta).toContain('Opción inválida');
    expect(respuesta).toContain('¿En qué tipo de establecimiento'); // menú re-mostrado
  });

  it('en el paso de establecimiento, una opción inválida vuelve a mostrar la lista', async () => {
    await crearBase('Playa Costanera', 'playa');
    await crearBase('Base Piedras', 'base');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');
    await paso('2');

    const respuesta = await paso('9');
    expect(respuesta).toContain('Opción inválida');
    expect(respuesta).toContain('Playa Costanera'); // lista re-mostrada
    expect(respuesta).not.toContain('Base Piedras');
  });

  it('si el tipo se queda sin establecimientos, vuelve al paso de tipo en vez de trabarse', async () => {
    const { Base } = await import('../../models/models.js');
    await crearBase('Playa Costanera', 'playa');
    await crearBase('Base Piedras', 'base');
    await crearUsuario({ telefono: TEL, nombreCompleto: 'Juan Perez' });

    await paso('crear');
    await paso('Se rompió la impresora');
    await paso('2'); // playa

    // El admin borra las playas mientras el usuario está eligiendo
    await Base.destroy({ where: { tipo: 'playa' } });

    const respuesta = await paso('1');
    expect(respuesta).toContain('Elegí el tipo de nuevo');
    expect(respuesta).toContain('1. Base');       // menú de tipos re-calculado
    expect(respuesta).not.toContain('Playa');     // ya no se ofrece el tipo vacío

    // Y puede seguir el flujo normalmente
    expect(await paso('1')).toContain('Base Piedras');
  });
});
