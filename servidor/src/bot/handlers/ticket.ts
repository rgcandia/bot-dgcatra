import { User, Ticket } from '../../models/models.js';
import { Conversacion } from '../../models/models.js';
import { Base } from '../../models/models.js';
import { getIO } from '../../socket/server.js';
import { Op } from 'sequelize';
import { enviarTexto, iniciarTyping } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';
import { generarTituloTicket } from '../groq.js';
import { esAfirmativo, esNegativo, esCancelar, normalizar } from '../helpers.js';
import { logger } from '../../config/logger.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

type TipoEstablecimiento = 'base' | 'playa' | 'comuna';

const ESTADOS_TICKET = {
  INICIAR: 0,
  PEDIR_DESCRIPCION: 1,
  PEDIR_TIPO: 2,
  PEDIR_BASE: 3,
  PEDIR_UBICACION: 4,
  CONFIRMAR: 5,
} as const;

/** Orden en que se ofrecen los tipos y su etiqueta visible. */
const TIPOS_ESTABLECIMIENTO: { tipo: TipoEstablecimiento; label: string; plural: string }[] = [
  { tipo: 'base', label: 'Base', plural: 'Bases' },
  { tipo: 'playa', label: 'Playa', plural: 'Playas' },
  { tipo: 'comuna', label: 'Comuna', plural: 'Comunas' },
];

/**
 * Tipos que tienen al menos un establecimiento cargado.
 * Evita ofrecer una categoría que después no tenga nada para elegir.
 */
async function tiposDisponibles() {
  const filas = await Base.findAll({ attributes: ['tipo'], group: ['tipo'] });
  const presentes = new Set(filas.map(f => f.tipo));
  return TIPOS_ESTABLECIMIENTO.filter(t => presentes.has(t.tipo));
}

function etiquetaTipo(tipo?: string | null): string {
  return TIPOS_ESTABLECIMIENTO.find(t => t.tipo === tipo)?.label || 'Establecimiento';
}

/** Resuelve el tipo elegido por botón (tipo_playa), número (2) o texto ("playa"). */
function resolverTipo(
  elegidos: { tipo: TipoEstablecimiento; label: string; plural: string }[],
  texto: string,
  buttonId?: string,
) {
  if (buttonId?.startsWith('tipo_')) {
    const t = elegidos.find(x => buttonId === `tipo_${x.tipo}`);
    if (t) return t;
  }
  const num = parseInt((texto || '').trim());
  if (!isNaN(num) && num >= 1 && num <= elegidos.length) return elegidos[num - 1];

  const t = normalizar(texto || '');
  if (t) {
    return elegidos.find(x => t === x.tipo || t === x.plural.toLowerCase() || t.includes(x.tipo)) || null;
  }
  return null;
}

export async function manejarCreacionTicket(ctx: Ctx): Promise<boolean> {
  const user = await obtenerUsuario(ctx.telefono);
  const paso = (user.context?.ticketPaso ?? ESTADOS_TICKET.INICIAR) as number;
  const ctxData = (user.context || {}) as any;

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

      const tipos = await tiposDisponibles();
      if (tipos.length === 0) {
        await enviarTexto(ctx.telefono, '❌ No hay establecimientos registrados en el sistema. Contactá a soporte.');
        await guardarUsuario(ctx.telefono, { context: null });
        return false;
      }

      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_TIPO;
      ctxData.descripcion = ctx.texto;
      await guardarUsuario(ctx.telefono, { context: ctxData });

      const options = tipos.map(t => ({ id: `tipo_${t.tipo}`, title: t.label }));
      // Guardar últimos botones para que parsearBotonNumerico funcione
      const { guardarUltimosBotones } = await import('../session.js');
      await guardarUltimosBotones(ctx.telefono, options);

      let msg = '🏢 *¿En qué tipo de establecimiento ocurre el problema?*\n\n';
      tipos.forEach((t, index) => { msg += `${index + 1}. ${t.label}\n`; });
      msg += '\nEscribí el número de la opción o *cancelar* para salir.';

      return await enviarTexto(ctx.telefono, msg);
    }

    case ESTADOS_TICKET.PEDIR_TIPO: {
      const tipos = await tiposDisponibles();
      if (tipos.length === 0) {
        await enviarTexto(ctx.telefono, '❌ No hay establecimientos registrados en el sistema. Contactá a soporte.');
        await guardarUsuario(ctx.telefono, { context: null });
        return false;
      }

      const elegido = resolverTipo(tipos, ctx.texto, ctx.buttonId);
      if (!elegido) {
        await enviarTexto(ctx.telefono,
          `❌ Opción inválida. Elegí un número del 1 al ${tipos.length} o el nombre del tipo:`);
        return false;
      }

      const bases = await Base.findAll({ where: { tipo: elegido.tipo }, order: [['nombre', 'ASC']] });
      if (bases.length === 0) {
        await enviarTexto(ctx.telefono,
          `❌ No hay establecimientos de tipo *${elegido.label}* cargados. Elegí otra opción.`);
        return false;
      }

      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_BASE;
      ctxData.baseTipo = elegido.tipo;
      await guardarUsuario(ctx.telefono, { context: ctxData });

      const options = bases.map(b => ({ id: `base_${b.id}`, title: b.nombre }));
      const { guardarUltimosBotones } = await import('../session.js');
      await guardarUltimosBotones(ctx.telefono, options);

      let msg = `📍 *Establecimientos de tipo ${elegido.label}:*\n\n`;
      bases.forEach((b, index) => {
        msg += `${index + 1}. ${b.nombre}${b.direccion ? ` — ${b.direccion}` : ''}\n`;
      });
      msg += '\nEscribí el número de la opción o *cancelar* para salir.';

      return await enviarTexto(ctx.telefono, msg);
    }

    case ESTADOS_TICKET.PEDIR_BASE: {
      const tipo = ctxData.baseTipo as TipoEstablecimiento | undefined;
      // Filtrar también acá: si el usuario manda un número de una lista vieja (de otro tipo),
      // no puede colar un establecimiento que no era de la categoría elegida.
      const bases = await Base.findAll({
        where: tipo ? { tipo } : {},
        order: [['nombre', 'ASC']],
      });

      let selectedBase: Base | null = null;

      if (ctx.buttonId && ctx.buttonId.startsWith('base_')) {
        const id = parseInt(ctx.buttonId.split('_')[1]);
        selectedBase = bases.find(b => b.id === id) || null;
      } else {
        const num = parseInt((ctx.texto || '').trim());
        if (!isNaN(num) && num >= 1 && num <= bases.length) {
          selectedBase = bases[num - 1];
        } else {
          // Fuzzy matching por nombre de establecimiento (solo dentro del tipo elegido)
          const textNorm = (ctx.texto || '').toLowerCase().trim();
          selectedBase = textNorm
            ? bases.find(b => b.nombre.toLowerCase().includes(textNorm)) || null
            : null;
        }
      }

      if (!selectedBase) {
        await enviarTexto(ctx.telefono,
          `❌ Opción inválida. Seleccioná el número del establecimiento (1 a ${bases.length}):`);
        return false;
      }

      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_UBICACION;
      ctxData.baseId = selectedBase.id;
      ctxData.baseNombre = selectedBase.nombre;

      await guardarUsuario(ctx.telefono, { context: ctxData });

      return await enviarTexto(ctx.telefono,
        '📍 *¿En qué oficina, sector o puesto específico del establecimiento ocurre el problema?*\n\n' +
        'Ej: "Oficina 3, primer piso" o "Mesa de entrada"\n\n' +
        'Escribí *cancelar* para salir.');
    }

    case ESTADOS_TICKET.PEDIR_UBICACION: {
      if (!ctx.texto || ctx.texto.length < 3) {
        await enviarTexto(ctx.telefono, '❌ Indicá una ubicación válida (mínimo 3 caracteres):');
        return false;
      }

      ctxData.ticketPaso = ESTADOS_TICKET.CONFIRMAR;
      ctxData.ubicacion = ctx.texto;

      await guardarUsuario(ctx.telefono, { context: ctxData });

      const descripcionCorta = ctxData.descripcion?.substring(0, 80);

      return await enviarTexto(ctx.telefono,
        '📋 *Confirmá los datos de tu reporte:*\n\n' +
        `👤 *Reporta:* ${user.nombreCompleto}\n` +
        `🏢 *Establecimiento:* ${ctxData.baseNombre} _(${etiquetaTipo(ctxData.baseTipo)})_\n` +
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

      const descripcion = ctxData.descripcion || '';
      const ubicacion = ctxData.ubicacion || '';
      const baseId = ctxData.baseId;

      if (!baseId) {
        // No debería pasar: solo se llega acá con baseId seteado.
        await guardarUsuario(ctx.telefono, { context: null });
        await enviarTexto(ctx.telefono, '❌ Se perdió el establecimiento seleccionado. Empezá de nuevo con *crear*.');
        return true;
      }

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
