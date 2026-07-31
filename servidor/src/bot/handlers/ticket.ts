import { User, Ticket } from '../../models/models.js';
import { enviarTexto, enviarBotones } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

const ESTADOS_TICKET = {
  INICIAR: 0,
  PEDIR_DESCRIPCION: 1,
  PEDIR_UBICACION: 2,
  CONFIRMAR: 3,
} as const;

export async function manejarCreacionTicket(ctx: Ctx): Promise<boolean> {
  const user = await obtenerUsuario(ctx.telefono);

  const paso = (user.context?.ticketPaso ?? ESTADOS_TICKET.INICIAR) as number;

  if (ctx.texto?.toLowerCase() === 'cancelar') {
    await guardarUsuario(ctx.telefono, { context: null });
    return await enviarTexto(ctx.telefono, 'Cancelado. Escribí *ayuda* para volver al menú.');
  }

  switch (paso) {
    case ESTADOS_TICKET.INICIAR: {
      await guardarUsuario(ctx.telefono, {
        context: { ticketPaso: ESTADOS_TICKET.PEDIR_DESCRIPCION },
      });
      return await enviarTexto(ctx.telefono,
        '📝 *Nuevo ticket*\n\n' +
        'Describí el problema técnico:\n\n' +
        'Ej: "La impresora no funciona en el sector legales"\n\n' +
        'Escribí *cancelar* para salir.');
    }

    case ESTADOS_TICKET.PEDIR_DESCRIPCION: {
      if (!ctx.texto || ctx.texto.length < 5) {
        await enviarTexto(ctx.telefono, '❌ Describí el problema con más detalle (mínimo 5 caracteres):');
        return false;
      }
      await guardarUsuario(ctx.telefono, {
        context: {
          ticketPaso: ESTADOS_TICKET.PEDIR_UBICACION,
          descripcion: ctx.texto,
        },
      });
      return await enviarTexto(ctx.telefono,
        '📍 ¿Dónde ocurre el problema?\n\n' +
        'Ej: "Oficina 3, primer piso, Base Piedras"\n\n' +
        'Escribí *cancelar* para salir.');
    }

    case ESTADOS_TICKET.PEDIR_UBICACION: {
      if (!ctx.texto || ctx.texto.length < 3) {
        await enviarTexto(ctx.telefono, '❌ Indicá una ubicación válida:');
        return false;
      }

      const ctxData = (user.context || {}) as any;
      ctxData.ticketPaso = ESTADOS_TICKET.CONFIRMAR;
      ctxData.ubicacion = ctx.texto;

      await guardarUsuario(ctx.telefono, { context: ctxData });

      const descripcion = ctxData.descripcion?.substring(0, 80);
      return await enviarBotones(ctx.telefono,
        '📋 *Confirmá el ticket:*\n\n' +
        `📝 *Problema:* ${descripcion}${(ctxData.descripcion?.length || 0) > 80 ? '...' : ''}\n` +
        `📍 *Ubicación:* ${ctxData.ubicacion}\n\n` +
        '¿Querés enviarlo?',
        [
          { id: 'ticket_confirmar', title: 'Enviar' },
          { id: 'cancelar', title: 'Cancelar' },
        ],
      );
    }

    case ESTADOS_TICKET.CONFIRMAR: {
      if (ctx.buttonId !== 'ticket_confirmar') return false;

      const ctxData = (user.context || {}) as any;
      const asunto = (ctxData.descripcion || '').substring(0, 100);

      const ticket = await Ticket.create({
        asunto,
        descripcion: ctxData.descripcion || '',
        ubicacion: ctxData.ubicacion || '',
        baseId: user.baseId!,
        sectorId: user.sectorId,
        userTelefono: ctx.telefono,
        estado: 'abierto',
        prioridad: 'media',
        historial: [{
          accion: 'Ticket creado por WhatsApp',
          autor: ctx.telefono,
          timestamp: new Date().toISOString(),
        }],
      });

      await guardarUsuario(ctx.telefono, { context: null });

      return await enviarTexto(ctx.telefono,
        `✅ *Ticket #${ticket.id} creado con éxito*\n\n` +
        `Tu ticket fue registrado y un técnico lo va a tomar a la brevedad.\n\n` +
        `📝 ${asunto}\n` +
        `📍 ${ctxData.ubicacion}\n` +
        `🆔 #${ticket.id}\n\n` +
        'Escribí *ayuda* para ver el menú.');
    }

    default:
      return false;
  }
}
