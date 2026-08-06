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

  it('rechaza ticketPaso > 3', () => {
    const result = TicketContextSchema.safeParse({ ticketPaso: 5 });
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
      baseId: 1,
      baseNombre: 'Base Piedras',
      sectorId: 2,
      sectorNombre: 'Operativo',
      nombre: 'Ale Candia',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza baseId negativo', () => {
    const result = RegisterContextSchema.safeParse({ baseId: -1, baseNombre: 'test' });
    expect(result.success).toBe(false);
  });

  it('rechaza email inválido', () => {
    const result = RegisterContextSchema.safeParse({
      baseId: 1,
      baseNombre: 'test',
      email: 'no-valido',
    });
    expect(result.success).toBe(false);
  });
});

describe('PendingCommandSchema', () => {
  it('valida comando cerrar', () => {
    const result = PendingCommandSchema.safeParse({ pendingCommand: 'cerrar' });
    expect(result.success).toBe(true);
  });

  it('rechaza comando inválido', () => {
    const result = PendingCommandSchema.safeParse({ pendingCommand: 'invalidar' });
    expect(result.success).toBe(false);
  });
});
