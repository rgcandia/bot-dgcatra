/**
 * Tests de integración del bloqueo por fuerza bruta (rate limiters de /api/auth).
 * Va en su propio archivo porque los limiters cuentan por IP y son estado del módulo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Express } from 'express';
import { prepararDB, cerrarDB, limpiarTablas, crearAppDeTest, crearUsuario, ipHeaders, TELEFONOS, request } from './setup.js';

vi.mock('../../bot/enviar.js', () => ({
  enviarTexto: async () => true,
  enviarBotones: async () => true,
  enviarLista: async () => true,
  iniciarTyping: async () => {},
  setClient: () => {},
  registrarChatId: () => {},
}));

let app: Express;

beforeAll(async () => {
  await prepararDB();
  app = await crearAppDeTest();
  await limpiarTablas();
  await crearUsuario({ telefono: TELEFONOS.usuario, nombreCompleto: 'Ale Candia' });
  const { setBotConnected } = await import('../../socket/server.js');
  setBotConnected('5491126259181');
});

afterAll(async () => {
  await cerrarDB();
});

describe('Bloqueo por intentos fallidos', () => {
  it('bloquea a los 10 intentos fallidos de verificación (429)', async () => {
    const ip = ipHeaders(90);
    const respuestas: number[] = [];

    // Sin código solicitado, todos los intentos fallan con 401 hasta que salta el limiter
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/auth/verificar-codigo')
        .set(ip)
        .send({ telefono: TELEFONOS.usuario, codigo: `00000${i}` });
      respuestas.push(res.status);
      if (res.status === 429) {
        expect(res.body.error).toMatch(/demasiados intentos/i);
      }
    }

    expect(respuestas.slice(0, 10).every(s => s === 401)).toBe(true);
    expect(respuestas[10]).toBe(429);
  });

  it('bloquea a los 5 pedidos de código por ventana de 5 minutos (429)', async () => {
    const ip = ipHeaders(91);
    const respuestas: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/api/auth/solicitar-codigo').set(ip).send({ telefono: TELEFONOS.usuario });
      respuestas.push(res.status);
    }

    expect(respuestas.slice(0, 5).every(s => s === 200)).toBe(true);
    expect(respuestas[5]).toBe(429);
  });

  it('el bloqueo es por IP: otra IP sigue pudiendo operar', async () => {
    const res = await request(app).post('/api/auth/solicitar-codigo').set(ipHeaders(92)).send({ telefono: TELEFONOS.usuario });
    expect(res.status).toBe(200);
  });
});
