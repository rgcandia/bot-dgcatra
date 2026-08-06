import { z } from 'zod';

export const TicketContextSchema = z.object({
  ticketPaso: z.number().int().min(0).max(3),
  descripcion: z.string().optional(),
  ubicacion: z.string().optional(),
  _lastActivity: z.number().optional(),
});

export const RegisterContextSchema = z.object({
  baseId: z.number().int().positive(),
  baseNombre: z.string(),
  sectorId: z.number().int().positive().optional(),
  sectorNombre: z.string().optional(),
  esAdmin: z.boolean().optional(),
  nombre: z.string().optional(),
  email: z.string().email().optional(),
  _lastButtons: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
  _lastActivity: z.number().optional(),
});

export const PendingCommandSchema = z.object({
  pendingCommand: z.enum(['cerrar', 'reabrir', 'cancelarTicket', 'verTicket']),
  _lastActivity: z.number().optional(),
});

export type TicketContext = z.infer<typeof TicketContextSchema>;
export type RegisterContext = z.infer<typeof RegisterContextSchema>;
export type PendingCommand = z.infer<typeof PendingCommandSchema>;
