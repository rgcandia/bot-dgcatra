import { describe, it, expect } from 'vitest';
import { TicketContextSchema, RegisterContextSchema, PendingCommandSchema } from '../bot/schemas.js';

describe('TicketContextSchema', () => {
  it('valida un context de ticket válido', () => {
    const result = TicketContextSchema.safeParse({ ticketPaso: 1, descripcion: 'test', ubicacion: 'oficina' });
    expect(result.success).toBe(true);
  });

  it('rechaza ticketPaso negativo', () => {
    const result = TicketContextSchema.safeParse({ ticketPaso: -1 });
    expect(result.success).toBe(false);
  });

  it('rechaza ticketPaso > 5', () => {
    const result = TicketContextSchema.safeParse({ ticketPaso: 6 });
    expect(result.success).toBe(false);
  });

  it('acepta campos opcionales vacíos', () => {
    const result = TicketContextSchema.safeParse({ ticketPaso: 0 });
    expect(result.success).toBe(true);
  });
});

describe('RegisterContextSchema', () => {
  it('valida un context de registro completo', () => {
    const result = RegisterContextSchema.safeParse({
      nombre: 'Ale Candia',
    });
    expect(result.success).toBe(true);
  });
});

describe('PendingCommandSchema', () => {
  it('valida comando cerrar', () => {
    const result = PendingCommandSchema.safeParse({ pendingCommand: 'cerrar' });
    expect(result.success).toBe(true);
  });

  it('valida comando cerrar con ticketId', () => {
    const result = PendingCommandSchema.safeParse({ pendingCommand: 'cerrar', ticketId: 5 });
    expect(result.success).toBe(true);
  });

  it('rechaza comando inválido', () => {
    const result = PendingCommandSchema.safeParse({ pendingCommand: 'invalidar' });
    expect(result.success).toBe(false);
  });
});
