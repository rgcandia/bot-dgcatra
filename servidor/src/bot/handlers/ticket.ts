import { User, Ticket } from '../../models/models.js';
import { Conversacion } from '../../models/models.js';
import { Base } from '../../models/models.js';
import { getIO } from '../../socket/server.js';
import { Op } from 'sequelize';
import { enviarTexto, enviarBotones, iniciarTyping, enviarLista } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';
import { generarTituloTicket } from '../groq.js';
import { esAfirmativo, esNegativo, esCancelar, esCercano } from '../helpers.js';
import { logger } from '../../config/logger.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

const ESTADOS_TICKET = {
  INICIAR: 0,
  PEDIR_DESCRIPCION: 1,
  PEDIR_BASE: 2,
  PEDIR_UBICACION: 3,
  CONFIRMAR: 4,
} as const;

export async function manejarCreacionTicket(ctx: Ctx): Promise<boolean> {
  const user = await obtenerUsuario(ctx.telefono);
  const paso = (user.context?.ticketPaso ?? ESTADOS_TICKET.INICIAR) as number;

  if (esCancelar(ctx.texto || '')) {
    await guardarUsuario(ctx.telefono, { context: null });
    return await enviarTexto(ctx.telefono, 'Cancelado. Escribí *ayuda* para volver al menú.');
  }

  switch (paso) {
    case ESTADOS_TICKET.INICIAR: {
      await guardarUsuario(ctx.telefono, {
        context: { ticketPaso: ESTADOS_TICKET.PEDIR_DESCRIPCION, _ticketStart: Date.now() },
      });
      return await enviarTexto(ctx.telefono,
        '🎫 *¡Dale, Creemos un Ticket!*\n\n' +
        'Describí el problema técnico:\n\n' +
        'Ej: "La impresora no imprime" o "No tengo acceso a internet"\n\n' +
        'Escribí *cancelar* para salir.');
    }

    case ESTADOS_TICKET.PEDIR_DESCRIPCION: {
      if (!ctx.texto || ctx.texto.length < 5) {
        await enviarTexto(ctx.telefono, '❌ Describí el problema con más detalle (mínimo 5 caracteres):');
        return false;
      }
      const ctxData = (user.context || {}) as any;
      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_BASE;
      ctxData.descripcion = ctx.texto;

      // Obtener bases para armar la lista numerada
      const bases = await Base.findAll({ order: [['nombre', 'ASC']] });
      if (bases.length === 0) {
        await enviarTexto(ctx.telefono, '❌ No hay bases registradas en el sistema. Contactá a soporte.');
        await guardarUsuario(ctx.telefono, { context: null });
        return false;
      }

      await guardarUsuario(ctx.telefono, { context: ctxData });

      const options = bases.map(b => ({ id: `base_${b.id}`, title: b.nombre }));
      // Guardar últimos botones para que parsearBotonNumerico funcione
      const { guardarUltimosBotones } = await import('../session.js');
      await guardarUltimosBotones(ctx.telefono, options);

      let msgBases = '🏢 *Seleccioná el establecimiento o base donde ocurre el problema:*\n\n';
      bases.forEach((b, index) => {
        msgBases += `${index + 1}. ${b.nombre}\n`;
      });
      msgBases += '\nEscribí el número de la opción o *cancelar* para salir.';

      return await enviarTexto(ctx.telefono, msgBases);
    }

    case ESTADOS_TICKET.PEDIR_BASE: {
      const bases = await Base.findAll({ order: [['nombre', 'ASC']] });
      let selectedBase: Base | null = null;

      // Intentamos resolver por buttonId (si vino desde botón emulado o número de opción)
      if (ctx.buttonId && ctx.buttonId.startsWith('base_')) {
        const id = parseInt(ctx.buttonId.split('_')[1]);
        selectedBase = bases.find(b => b.id === id) || null;
      } else {
        // Intentar parseo numérico por texto directamente
        const num = parseInt(ctx.texto.trim());
        if (!isNaN(num) && num >= 1 && num <= bases.length) {
          selectedBase = bases[num - 1];
        } else {
          // Fuzzy matching por nombre de base
          const textNorm = ctx.texto.toLowerCase().trim();
          selectedBase = bases.find(b => b.nombre.toLowerCase().includes(textNorm)) || null;
        }
      }

      if (!selectedBase) {
        await enviarTexto(ctx.telefono, '❌ Opción inválida. Seleccioná el número de base correspondiente:');
        return false;
      }

      const ctxData = (user.context || {}) as any;
      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_UBICACION;
      ctxData.baseId = selectedBase.id;
      ctxData.baseNombre = selectedBase.nombre;

      await guardarUsuario(ctx.telefono, { context: ctxData });

      return await enviarTexto(ctx.telefono,
        '📍 *¿En qué oficina, sector o puesto específico de la base ocurre el problema?*\n\n' +
        'Ej: "Oficina 3, primer piso" o "Mesa de entrada"\n\n' +
        'Escribí *cancelar* para salir.');
    }

    case ESTADOS_TICKET.PEDIR_UBICACION: {
      if (!ctx.texto || ctx.texto.length < 3) {
        await enviarTexto(ctx.telefono, '❌ Indicá una ubicación válida (mínimo 3 caracteres):');
        return false;
      }

      const ctxData = (user.context || {}) as any;
      ctxData.ticketPaso = ESTADOS_TICKET.CONFIRMAR;
      ctxData.ubicacion = ctx.texto;

      await guardarUsuario(ctx.telefono, { context: ctxData });

      const descripcionCorta = ctxData.descripcion?.substring(0, 80);

      return await enviarTexto(ctx.telefono,
        '📋 *Confirmá los datos de tu reporte:*\n\n' +
        `👤 *Reporta:* ${user.nombreCompleto}\n` +
        `🏢 *Base:* ${ctxData.baseNombre}\n` +
        `📍 *Ubicación:* ${ctxData.ubicacion}\n` +
        `📝 *Problema:* ${descripcionCorta}${(ctxData.descripcion?.length || 0) > 80 ? '...' : ''}\n\n` +
        'Respondé *SI* para enviarlo o *NO* para cancelar.');
    }

    case ESTADOS_TICKET.CONFIRMAR: {
      const textoLower = (ctx.texto || '').toLowerCase().trim();
      if (esNegativo(textoLower)) {
        await guardarUsuario(ctx.telefono, { context: null });
        return await enviarTexto(ctx.telefono, 'Cancelado. Escribí *ayuda* para ver el menú.');
      }
      if (!esAfirmativo(textoLower)) {
        await enviarTexto(ctx.telefono, 'Respondé *SI* para confirmar o *NO* para cancelar.');
        return false;
      }

      const ctxData = (user.context || {}) as any;
      const descripcion = ctxData.descripcion || '';
      const ubicacion = ctxData.ubicacion || '';
      const baseId = ctxData.baseId;

      let asunto = descripcion.substring(0, 60);
      iniciarTyping(ctx.telefono); // fire-and-forget: typing de fondo
      try {
        const t = await generarTituloTicket(descripcion, ubicacion);
        if (t) asunto = t;
      } catch (e: any) {
        logger.warn({ err: e?.message }, 'IA título falló, usando fallback');
      }

      const ticket = await Ticket.create({
        asunto,
        descripcion,
        ubicacion,
        baseId,
        userTelefono: ctx.telefono,
        estado: 'abierto',
        prioridad: 'media',
        historial: [{
          accion: `${user.nombreCompleto || ctx.telefono} creó el ticket`,
          autor: user.nombreCompleto || ctx.telefono,
          timestamp: new Date().toISOString(),
        }],
      });

      const ticketStart = (ctxData._ticketStart as number | undefined) ?? Date.now() - 10 * 60 * 1000;
      Conversacion.update(
        { ticketId: ticket.id },
        {
          where: {
            userTelefono: ctx.telefono,
            ticketId: null,
            createdAt: { [Op.gte]: new Date(ticketStart) },
          },
        },
      ).catch(e => logger.error({ err: e?.message }, 'backfill Conversacion'));

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
        }).catch(e => logger.error({ err: e?.message }, 'socket ticket-creado'));
      }

      return await enviarTexto(ctx.telefono,
        `✅ *Ticket #${ticket.id}*: "${ticket.asunto}" creado con éxito.\n\n` +
        `Un técnico lo va a revisar a la brevedad.\n` +
        `Si querés cerrarlo o cancelarlo, escribí *cerrar ${ticket.id}*.\n\n` +
        'Escribí *ayuda* para ver el menú.',
        ticket.id);
    }

    default:
      return false;
  }
}
