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

type TipoOpcion = { tipo: TipoEstablecimiento; label: string; plural: string };

/** Solo dígitos: evita que "9 de Julio" se lea como el índice 9. */
function esNumero(texto: string): boolean {
  return /^\d+$/.test((texto || '').trim());
}

/** Resuelve el tipo elegido por botón (tipo_playa), número (2) o texto ("playa"). */
function resolverTipo(elegidos: TipoOpcion[], texto: string, buttonId?: string): TipoOpcion | null {
  if (buttonId?.startsWith('tipo_')) {
    const t = elegidos.find(x => buttonId === `tipo_${x.tipo}`);
    if (t) return t;
  }

  const raw = (texto || '').trim();
  // Si escribió un número, se interpreta SOLO como índice: nunca cae a búsqueda por nombre.
  if (esNumero(raw)) {
    const num = parseInt(raw, 10);
    return (num >= 1 && num <= elegidos.length) ? elegidos[num - 1] : null;
  }

  const t = normalizar(raw);
  if (!t) return null;
  return elegidos.find(x =>
    t === x.tipo || t === x.label.toLowerCase() || t === x.plural.toLowerCase() || t.includes(x.tipo),
  ) || null;
}

/** Muestra (o vuelve a mostrar) el menú de tipos, guardando los botones para el parseo numérico. */
async function mostrarTipos(telefono: string, tipos: TipoOpcion[]): Promise<boolean> {
  const { guardarUltimosBotones } = await import('../session.js');
  await guardarUltimosBotones(telefono, tipos.map(t => ({ id: `tipo_${t.tipo}`, title: t.label })));

  let msg = '🏢 *¿En qué tipo de establecimiento ocurre el problema?*\n\n';
  tipos.forEach((t, index) => { msg += `${index + 1}. ${t.label}\n`; });
  msg += '\nEscribí el número de la opción o *cancelar* para salir.';
  return await enviarTexto(telefono, msg);
}

/** Muestra (o vuelve a mostrar) los establecimientos de un tipo. */
async function mostrarBases(telefono: string, tipo: TipoOpcion, bases: Base[]): Promise<boolean> {
  const { guardarUltimosBotones } = await import('../session.js');
  await guardarUltimosBotones(telefono, bases.map(b => ({ id: `base_${b.id}`, title: b.nombre })));

  let msg = `📍 *Establecimientos de tipo ${tipo.label}:*\n\n`;
  bases.forEach((b, index) => {
    msg += `${index + 1}. ${b.nombre}${b.direccion ? ` — ${b.direccion}` : ''}\n`;
  });
  msg += '\nEscribí el número de la opción o *cancelar* para salir.';
  return await enviarTexto(telefono, msg);
}

/** El usuario quedó sin opciones para elegir: mensaje claro y fin del flujo. */
async function abortarSinEstablecimientos(telefono: string, tipos: TipoOpcion[]): Promise<boolean> {
  const detalle = tipos.length === 0
    ? 'No hay establecimientos cargados en este momento.'
    : 'No hay establecimientos de ese tipo cargados.';
  await enviarTexto(telefono, `❌ ${detalle} Contactá a soporte.`);
  await guardarUsuario(telefono, { context: null });
  return false;
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
      if (tipos.length === 0) return await abortarSinEstablecimientos(ctx.telefono, tipos);

      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_TIPO;
      ctxData.descripcion = ctx.texto;
      await guardarUsuario(ctx.telefono, { context: ctxData });

      return await mostrarTipos(ctx.telefono, tipos);
    }

    case ESTADOS_TICKET.PEDIR_TIPO: {
      const tipos = await tiposDisponibles();
      if (tipos.length === 0) return await abortarSinEstablecimientos(ctx.telefono, tipos);

      const elegido = resolverTipo(tipos, ctx.texto, ctx.buttonId);
      if (!elegido) {
        // Opción inválida: se re-muestra el menú completo para no dejar al usuario a ciegas.
        await enviarTexto(ctx.telefono,
          `❌ Opción inválida. Elegí un número del 1 al ${tipos.length} o el nombre del tipo:`);
        return await mostrarTipos(ctx.telefono, tipos);
      }

      const bases = await Base.findAll({ where: { tipo: elegido.tipo }, order: [['nombre', 'ASC']] });
      if (bases.length === 0) {
        // El tipo se quedó sin establecimientos (los borraron desde el dashboard): volver a elegir.
        const restantes = tipos.filter(t => t.tipo !== elegido.tipo);
        if (restantes.length === 0) return await abortarSinEstablecimientos(ctx.telefono, restantes);
        await enviarTexto(ctx.telefono,
          `❌ No hay establecimientos de tipo *${elegido.label}* cargados. Elegí otra opción:`);
        return await mostrarTipos(ctx.telefono, restantes);
      }

      ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_BASE;
      ctxData.baseTipo = elegido.tipo;
      await guardarUsuario(ctx.telefono, { context: ctxData });

      return await mostrarBases(ctx.telefono, elegido, bases);
    }

    case ESTADOS_TICKET.PEDIR_BASE: {
      const tipo = ctxData.baseTipo as TipoEstablecimiento | undefined;
      // Filtrar también acá: si el usuario manda un número de una lista vieja (de otro tipo),
      // no puede colar un establecimiento que no era de la categoría elegida.
      const bases = await Base.findAll({
        where: tipo ? { tipo } : {},
        order: [['nombre', 'ASC']],
      });

      const tipoOpcion = TIPOS_ESTABLECIMIENTO.find(t => t.tipo === tipo);

      // Se quedó sin establecimientos para mostrar: volver al paso de tipo en vez de
      // dejarlo en un "elegí del 1 al 0" imposible de responder.
      if (bases.length === 0) {
        ctxData.ticketPaso = ESTADOS_TICKET.PEDIR_TIPO;
        await guardarUsuario(ctx.telefono, { context: ctxData });
        const tipos = await tiposDisponibles();
        if (tipos.length === 0) return await abortarSinEstablecimientos(ctx.telefono, tipos);
        await enviarTexto(ctx.telefono, '❌ No hay establecimientos cargados para ese tipo. Elegí el tipo de nuevo:');
        return await mostrarTipos(ctx.telefono, tipos);
      }

      const reMostrar = async () => {
        await enviarTexto(ctx.telefono,
          `❌ Opción inválida. Seleccioná el número del establecimiento (1 a ${bases.length}):`);
        return await mostrarBases(ctx.telefono, tipoOpcion ?? TIPOS_ESTABLECIMIENTO[0], bases);
      };

      let selectedBase: Base | null = null;

      if (ctx.buttonId && ctx.buttonId.startsWith('base_')) {
        const id = parseInt(ctx.buttonId.split('_')[1], 10);
        selectedBase = bases.find(b => b.id === id) || null;
      } else {
        const raw = (ctx.texto || '').trim();
        if (esNumero(raw)) {
          // Un número es siempre un índice de la lista, nunca el nombre de un establecimiento.
          const num = parseInt(raw, 10);
          if (num >= 1 && num <= bases.length) selectedBase = bases[num - 1];
        } else if (raw.length >= 3) {
          // Búsqueda por nombre (sin acentos), solo dentro del tipo elegido.
          const buscado = normalizar(raw);
          selectedBase = bases.find(b => normalizar(b.nombre).includes(buscado)) || null;
        }
      }

      if (!selectedBase) return await reMostrar();

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
