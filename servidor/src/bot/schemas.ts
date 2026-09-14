import { z } from 'zod';

export const TicketContextSchema = z.object({
  // Pasos: 0 iniciar · 1 descripción · 2 tipo · 3 establecimiento · 4 ubicación · 5 confirmar
  ticketPaso: z.number().int().min(0).max(5),
  descripcion: z.string().optional(),
  baseTipo: z.enum(['base', 'playa', 'comuna']).optional(),
  baseId: z.number().int().positive().optional(),
  baseNombre: z.string().optional(),
  ubicacion: z.string().optional(),
  _ticketStart: z.number().optional(),
  _lastActivity: z.number().optional(),
});

export const RegisterContextSchema = z.object({
  nombre: z.string().optional(),
  _lastButtons: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
  _lastActivity: z.number().optional(),
});

export const PendingCommandSchema = z.object({
  pendingCommand: z.enum(['cerrar', 'reabrir', 'cancelarTicket', 'verTicket']),
  ticketId: z.number().int().positive().optional(),
  _lastActivity: z.number().optional(),
});

export type TicketContext = z.infer<typeof TicketContextSchema>;
export type RegisterContext = z.infer<typeof RegisterContextSchema>;
export type PendingCommand = z.infer<typeof PendingCommandSchema>;
