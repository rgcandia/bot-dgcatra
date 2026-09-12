/**
 * Tests unitarios de la identidad de WhatsApp (LID vs. teléfono).
 * No tocan la DB: el cliente de WhatsApp se inyecta como mock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Client } from 'whatsapp-web.js';
import { resolverIdentidad, limpiarNumero, esLid, limpiarCacheIdentidad } from '../bot/identidad.js';

// enviar.ts arrastra session/models (y por lo tanto la DB): se mockea para que el test sea puro.
vi.mock('../bot/enviar.js', () => ({
  setClient: () => {},
  obtenerCliente: () => null,
  registrarChatId: () => {},
  enviarTexto: async () => true,
  enviarBotones: async () => true,
  enviarLista: async () => true,
  iniciarTyping: async () => {},
}));

const LID = '30262373163147@lid';

function clienteQueDevuelve(respuestas: any[] | (() => Promise<any>)): Client {
  const fn = typeof respuestas === 'function' ? respuestas : async () => respuestas;
  return { getContactLidAndPhone: vi.fn(fn) } as unknown as Client;
}

beforeEach(() => limpiarCacheIdentidad());

describe('helpers', () => {
  it('limpiarNumero deja solo dígitos y esLid detecta el sufijo @lid', () => {
    expect(limpiarNumero('5491166086509@c.us')).toBe('5491166086509');
    expect(limpiarNumero(LID)).toBe('30262373163147');
    expect(esLid(LID)).toBe(true);
    expect(esLid('5491166086509@c.us')).toBe(false);
  });
});

describe('resolverIdentidad', () => {
  it('con un teléfono normal (@c.us) no consulta al cliente', async () => {
    const client = clienteQueDevuelve([]);
    const id = await resolverIdentidad('5491166086509@c.us', client);

    expect(id).toMatchObject({ telefono: '5491166086509', resuelto: false, chatId: '5491166086509@c.us' });
    expect(client.getContactLidAndPhone).not.toHaveBeenCalled();
  });

  it('resuelve el LID al teléfono real y conserva el LID como chatId', async () => {
    const client = clienteQueDevuelve([{ lid: LID, pn: '5491166086509@c.us' }]);
    const id = await resolverIdentidad(LID, client);

    expect(id).toEqual({ telefono: '5491166086509', chatId: LID, resuelto: true });
    expect(client.getContactLidAndPhone).toHaveBeenCalledWith([LID]);
  });

  it('normaliza el teléfono resuelto al formato canónico', async () => {
    // pn que no viene en formato canónico: se normaliza igual
    const client = clienteQueDevuelve([{ lid: LID, pn: '1166086509@c.us' }]);
    const id = await resolverIdentidad(LID, client);

    expect(id.telefono).toBe('5491166086509');
    expect(id.resuelto).toBe(true);
  });

  it('usa la caché: el segundo mensaje del mismo LID no vuelve a consultar', async () => {
    const client = clienteQueDevuelve([{ lid: LID, pn: '5491166086509@c.us' }]);

    await resolverIdentidad(LID, client);
    const id = await resolverIdentidad(LID, client);

    expect(id.telefono).toBe('5491166086509');
    expect(client.getContactLidAndPhone).toHaveBeenCalledTimes(1);
  });

  it('cae al LID si el pn viene vacío', async () => {
    const client = clienteQueDevuelve([{ lid: LID, pn: '' }]);
    const id = await resolverIdentidad(LID, client);

    expect(id).toEqual({ telefono: '30262373163147', chatId: LID, resuelto: false });
  });

  it('cae al LID si el cliente tira error (nunca rompe el flujo)', async () => {
    const client = clienteQueDevuelve(async () => {
      throw new Error('enforceLidAndPnRetrieval falló');
    });
    const id = await resolverIdentidad(LID, client);

    expect(id).toEqual({ telefono: '30262373163147', chatId: LID, resuelto: false });
  });

  it('cae al LID si no hay cliente de WhatsApp disponible', async () => {
    const id = await resolverIdentidad(LID, null);
    expect(id).toEqual({ telefono: '30262373163147', chatId: LID, resuelto: false });
  });

  it('un fallo no queda cacheado: el próximo mensaje reintenta', async () => {
    const cliente = clienteQueDevuelve(async () => [{ lid: LID, pn: '' }]);
    await resolverIdentidad(LID, cliente);
    await resolverIdentidad(LID, cliente);

    expect(cliente.getContactLidAndPhone).toHaveBeenCalledTimes(2);
  });
});
