import { User, Ticket } from '../../models/models.js';
import { Conversacion } from '../../models/models.js';
import { Base } from '../../models/models.js';
import { getIO } from '../../socket/server.js';
import { Op } from 'sequelize';
import { enviarTexto, enviarBotones, iniciarTyping } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';
import { generarTituloTicket } from '../groq.js';

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
        'Ej: "La impresora no imprime" o "No tengo acceso a internet"\n\n' +
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
      let msjUbicacion = '📍 ¿Dónde ocurre el problema?\n\n' +
        'Ej: "Oficina 3, primer piso" o "Entrada principal"';
      if (user.baseId) {
        try {
          const base = await Base.findByPk(user.baseId);
          if (base) {
            msjUbicacion += `\nSi es en otra base distinta a *${base.nombre}*, aclaralo. Ej: "Base Once, recepción"`;
          }
        } catch {}
      }
      msjUbicacion += '\n\nEscribí *cancelar* para salir.';
      return await enviarTexto(ctx.telefono, msjUbicacion);
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

      return await enviarTexto(ctx.telefono,
        '📋 *Confirmá el ticket:*\n\n' +
        `📝 *Problema:* ${descripcion}${(ctxData.descripcion?.length || 0) > 80 ? '...' : ''}\n` +
        `📍 *Ubicación:* ${ctxData.ubicacion}\n\n` +
        'Respondé *SI* para enviarlo o *NO* para cancelar.');
    }

    case ESTADOS_TICKET.CONFIRMAR: {
      const textoLower = ctx.texto.toLowerCase().trim();
      if (['no', 'cancelar', 'cancelo', 'n'].includes(textoLower)) {
        await guardarUsuario(ctx.telefono, { context: null });
        return await enviarTexto(ctx.telefono, 'Cancelado. Escribí *ayuda* para ver el menú.');
      }
      if (!['si', 'sí', 's', 'dale', 'ok', 'confirmo', 'confirmar'].some(c => textoLower.startsWith(c))) {
        await enviarTexto(ctx.telefono, 'Respondé *SI* para confirmar o *NO* para cancelar.');
        return false;
      }

      const ctxData = (user.context || {}) as any;
      const descripcion = ctxData.descripcion || '';
      const ubicacion = ctxData.ubicacion || '';

      let asunto = descripcion.substring(0, 60);
      iniciarTyping(ctx.telefono); // fire-and-forget: typing mientras la IA procesa
      try {
        const t = await generarTituloTicket(descripcion, ubicacion);
        if (t) asunto = t;
      } catch (e: any) {
        console.log('🤖 IA título falló, usando fallback:', e?.message || e);
      }

      if (!user.baseId) {
        await enviarTexto(ctx.telefono, '❌ Error: no tenés una base asignada. Contactá a sistemas.');
        return false;
      }

      const ticket = await Ticket.create({
        asunto,
        descripcion: ctxData.descripcion || '',
        ubicacion: ctxData.ubicacion || '',
        baseId: user.baseId,
        sectorId: user.sectorId,
        userTelefono: ctx.telefono,
        estado: 'abierto',
        prioridad: 'media',
        historial: [{
          accion: `${user.nombreCompleto || ctx.telefono} creó el ticket`,
          autor: user.nombreCompleto || ctx.telefono,
          timestamp: new Date().toISOString(),
        }],
      });

      Conversacion.update(
        { ticketId: ticket.id },
        {
          where: {
            userTelefono: ctx.telefono,
            ticketId: null,
            createdAt: { [Op.gte]: new Date(Date.now() - 10 * 60 * 1000) },
          },
        },
      ).catch(() => {});

      await guardarUsuario(ctx.telefono, { context: null });

      const io = getIO();
      if (io) {
        Ticket.findByPk(ticket.id, {
          include: [
            { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
            { model: Base, as: 'base', attributes: ['nombre'] },
          ],
        }).then(fullTicket => {
          if (fullTicket) io.emit('ticket-creado', fullTicket);
        }).catch(() => {});
      }

      return await enviarTexto(ctx.telefono,
        `✅ *Ticket #${ticket.id} creado*\n\n` +
        `Un técnico lo va a revisar a la brevedad.\n` +
        `Si querés cancelarlo, escribí *cerrar ticket ${ticket.id}*.\n\n` +
        'Escribí *ayuda* para ver el menú.',
        ticket.id);
    }

    default:
      return false;
  }
}
