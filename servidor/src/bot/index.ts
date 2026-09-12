import { manejarCreacionTicket } from './handlers/ticket.js';
import { manejarComandos } from './handlers/comandos.js';
import { obtenerUsuario, guardarUsuario, registrarMensajeEntrante } from './session.js';
import { registrarChatId } from './enviar.js';
import { resolverIdentidad, limpiarNumero } from './identidad.js';
import { migrarUsuarioDeLid } from './migrar-lid.js';
import { User } from '../models/models.js';
import { logger } from '../config/logger.js';
import { getIO } from '../socket/server.js';
import { esAfirmativo } from './helpers.js';

const colas = new Map<string, Promise<void>>();
const mensajesProcesados = new Set<string>();
const TTL_MENSAJE = 15_000; // 15 segundos

function encolar(telefono: string, fn: () => Promise<void>): Promise<void> {
  const anterior = colas.get(telefono) || Promise.resolve();
  const tarea = anterior.then(() => fn()).catch(e => {
    logger.error({ err: e?.message || e }, `Error en cola de ${telefono}`);
  }).finally(() => {
    if (colas.get(telefono) === tarea) colas.delete(telefono);
  });
  colas.set(telefono, tarea);
  return tarea;
}

function extraerButtonId(msg: any): string | undefined {
  if (msg.selectedButtonId) return msg.selectedButtonId;
  if (msg._data?.buttonsResponse?.selectedButtonId) return msg._data.buttonsResponse.selectedButtonId;
  if (msg._data?.listResponse?.singleSelectReply?.selectedRowId) {
    return msg._data.listResponse.singleSelectReply.selectedRowId;
  }
  if (msg._data?.interactiveAnnouncement?.nativeFlow?.messageParams?.action?.buttons?.[0]?.id) {
    return msg._data.interactiveAnnouncement.nativeFlow.messageParams.action.buttons[0].id;
  }
  return undefined;
}

function parsearBotonNumerico(texto: string, lastButtons?: { id: string; title: string }[]): string | undefined {
  if (!lastButtons || lastButtons.length === 0) return undefined;
  const num = parseInt(texto.trim());
  if (isNaN(num) || num < 1 || num > lastButtons.length) return undefined;
  return lastButtons[num - 1].id;
}

export async function procesarMensaje(msg: any) {
  const msgId = msg.id?.id || msg.id?._serialized;
  if (msgId) {
    if (mensajesProcesados.has(msgId)) {
      logger.warn({ msgId }, 'Mensaje duplicado ignorado');
      return;
    }
    mensajesProcesados.add(msgId);
    setTimeout(() => mensajesProcesados.delete(msgId), TTL_MENSAJE);
  }

  const rawFrom = msg.from;
  // WhatsApp puede mandar un LID (@lid) en vez del teléfono: se resuelve a la identidad real
  // (teléfono) conservando el LID como chatId para poder responderle.
  const identidad = await resolverIdentidad(rawFrom);
  const from = identidad.telefono;
  registrarChatId(from, rawFrom);

  // Consolida usuarios que habían quedado guardados con el LID (pre-fix), sin perder tickets ni historial.
  if (identidad.resuelto) {
    await migrarUsuarioDeLid(limpiarNumero(rawFrom), from);
  }

  // Asegurar que el usuario exista antes de guardar historial (evita FK violation en conversaciones)
  await User.findOrCreate({
    where: { telefono: from },
    defaults: { telefono: from, chatId: rawFrom, registroCompleto: false },
  }).catch(e => logger.error({ err: e?.message }, 'findOrCreate user'));

  // Guardar formato real de WhatsApp (@c.us o @lid) en la DB
  User.update({ chatId: rawFrom }, { where: { telefono: from } }).catch(e => logger.error({ err: e?.message }, 'update chatId'));

  const text = msg.body || '';
  const buttonId = extraerButtonId(msg);

  logger.info({ from: rawFrom, body: text || '(sin texto)', buttonId });

  registrarMensajeEntrante(from, text);

  encolar(from, () => procesarMensajeCola(msg, from, text, rawFrom, buttonId));
}

async function marcarComoLeido(msg: any, chatId: string) {
  try {
    const chat = await msg.getChat();
    await chat.sendSeen();
  } catch {}
}

async function procesarMensajeCola(msg: any, from: string, text: string, rawFrom: string, buttonId?: string) {
  await marcarComoLeido(msg, rawFrom);

  if (msg.hasMedia) {
    const { enviarTexto } = await import('./enviar.js');
    await enviarTexto(from,
      '📎 Recibí tu archivo, pero todavía no puedo procesar imágenes ni audios.\n\n' +
      'Describí el problema por texto así puedo crear el ticket.\n\n' +
      'Escribí *cancelar* para salir.');
    return;
  }

  if (!(text || '').trim()) {
    return;
  }

  const user = await obtenerUsuario(from);

  // Chat con admin activo → forward mensajes al dashboard
  const chatAdmin = (user.context as any)?.chatConAdmin;
  if (chatAdmin?.adminId) {
    const io = getIO();
    if (io) {
      io.emit('chat-mensaje-entrante', {
        userTelefono: from,
        mensaje: text || '(multimedia)',
        timestamp: new Date().toISOString(),
        adminId: chatAdmin.adminId,
      });
    }
    return;
  }

  const numericoId = parsearBotonNumerico(text, (user.context || {})?._lastButtons);
  const finalButtonId = buttonId || numericoId;

  // 🛡️ REGLA: Confirmación de administradores manuales (Fase 2.4)
  if (user.esAdmin && !user.confirmadoWhatsApp) {
    const { enviarTexto } = await import('./enviar.js');
    const esConfirmar = esAfirmativo(text) || text.toLowerCase().trim() === 'confirmar';
    if (esConfirmar) {
      await guardarUsuario(from, { confirmadoWhatsApp: true });
      await enviarTexto(from, '✨ ¡Listo! Tu cuenta como administrador ha sido activada con éxito.\n\nYa podés ingresar al panel de control de Tickets.');
    } else {
      await enviarTexto(from, '⚠️ Tu cuenta requiere activación. Por favor respondé *confirmar* para activar tu acceso al panel administrativo.');
    }
    return;
  }

  // 🛡️ REGLA: Pre-registro de Nombre Completo.
  // Si no tenemos el nombre completo del usuario, se lo pedimos primero.
  if (!user.nombreCompleto) {
    const { enviarTexto, enviarBotones } = await import('./enviar.js');
    const context = (user.context || {}) as any;

    if (!context.esperandoNombre) {
      // Guardar estado de que le pedimos el nombre
      context.esperandoNombre = true;
      await guardarUsuario(from, { context });
      await enviarTexto(from,
        '👋 *¡Hola! Bienvenido al Bot de Gestión de Tickets de Sistemas.*\n\n' +
        'Para poder ayudarte mejor, por favor ingresá tu *nombre y apellido completo* para continuar:');
      return;
    } else {
      // El usuario nos está respondiendo su nombre
      const nombreIngresado = text.trim();
      if (nombreIngresado.length < 4 || !nombreIngresado.includes(' ')) {
        await enviarTexto(from, '❌ Por favor ingresá tu nombre y apellido completos (mínimo 4 letras):');
        return;
      }

      // Guardar nombre, completar registro básico y borrar flag del context
      await guardarUsuario(from, {
        nombreCompleto: nombreIngresado,
        registroCompleto: true,
        context: null
      });

      // Confirmar y mostrar menú inicial
      await enviarBotones(from,
        `¡Perfecto, *${nombreIngresado}*! Ya quedaste registrado.\n\n` +
        `¿Qué querés hacer? Escribí el número de la opción:`,
        [
          { id: 'cmd_ticket', title: 'Generar reclamo' },
          { id: 'cmd_ayuda', title: 'Ayuda' },
          { id: 'cancelar', title: 'Cancelar' },
        ]
      );
      return;
    }
  }

  // Si ya tenemos el nombre, procesamos de manera normal
  await manejarFlujoRegistrado({ telefono: from, texto: text, buttonId: finalButtonId });
}

async function manejarFlujoRegistrado(ctx: { telefono: string; texto: string; buttonId?: string }) {
  const user = await obtenerUsuario(ctx.telefono);
  if (user.activo === false) {
    const { enviarTexto } = await import('./enviar.js');
    await enviarTexto(ctx.telefono, '🚫 Tu usuario está desactivado. Contactá al administrador.');
    return;
  }
  const context = (user.context || {}) as any;

  if (context.ticketPaso !== undefined && context.ticketPaso !== null) {
    await manejarCreacionTicket(ctx);
    return;
  }

  const handled = await manejarComandos(ctx);
  if (!handled) {
    await manejarCreacionTicket(ctx);
  }
}
