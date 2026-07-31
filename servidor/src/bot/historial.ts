import { Conversacion } from '../models/models.js';

export function guardarMensaje(
  telefono: string,
  texto: string,
  direccion: 'inbound' | 'outbound',
  ticketId?: number | null,
  metadata?: any,
) {
  const maxLen = 1000;
  const truncated = texto.length > maxLen ? texto.substring(0, maxLen) + '...' : texto;

  Conversacion.create({
    userTelefono: telefono,
    ticketId: ticketId ?? null,
    mensaje: truncated,
    direccion,
    metadata: metadata ?? null,
  }).catch(() => {});
}
