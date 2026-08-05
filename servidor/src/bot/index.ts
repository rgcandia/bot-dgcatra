import { manejarRegistro } from './handlers/registro.js';
import { manejarCreacionTicket } from './handlers/ticket.js';
import { manejarComandos } from './handlers/comandos.js';
import { obtenerUsuario, guardarUsuario, registrarMensajeEntrante, invalidarCache } from './session.js';
import { registrarChatId } from './enviar.js';

const colas = new Map<string, Promise<void>>();
const mensajesProcesados = new Set<string>();
const TTL_MENSAJE = 15_000; // 15 segundos

function encolar(telefono: string, fn: () => Promise<void>): Promise<void> {
  const anterior = colas.get(telefono) || Promise.resolve();
  const tarea = anterior.then(fn).finally(() => {
    if (colas.get(telefono) === tarea) colas.delete(telefono);
  });
  colas.set(telefono, tarea);
  return tarea;
}

function limpiarNumero(from: string): string {
  return from.split('@')[0].replace(/[^\d]/g, '');
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
      console.log(`🛡️ [Dedup] Mensaje ${msgId} ignorado (duplicado).`);
      return;
    }
    mensajesProcesados.add(msgId);
    setTimeout(() => mensajesProcesados.delete(msgId), TTL_MENSAJE);
  }

  const rawFrom = msg.from;
  const from = limpiarNumero(rawFrom);
  registrarChatId(from, rawFrom);

  const text = msg.body || '';
  const buttonId = extraerButtonId(msg);

  console.log(`📩 De: ${rawFrom}`);
  console.log(`💬 Mensaje: ${text || '(sin texto)'}`);
  if (buttonId) console.log(`🔘 Botón: ${buttonId}`);

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

  const user = await obtenerUsuario(from);

  const numericoId = parsearBotonNumerico(text, (user.context || {})?._lastButtons);
  const finalButtonId = buttonId || numericoId;

  if (user.registroCompleto) {
    await manejarFlujoRegistrado({ telefono: from, texto: text, buttonId: finalButtonId });
    return;
  }

  const textoLower = text.toLowerCase().trim();
  if (textoLower === 'hola' || textoLower === 'menu' || textoLower === 'ayuda' || textoLower === 'start') {
    await guardarUsuario(from, { pasoRegistro: 0, context: null, registroCompleto: false });
  }

  const procesado = await manejarRegistro({ telefono: from, texto: text, buttonId: finalButtonId });

  if (!procesado) {
    const paso = (await obtenerUsuario(from)).pasoRegistro ?? 0;
    if (paso === 0) {
      const { enviarTexto } = await import('./enviar.js');
      await enviarTexto(from, '👋 Escribí *hola* para comenzar el registro.');
    }
  }
}

async function manejarFlujoRegistrado(ctx: { telefono: string; texto: string; buttonId?: string }) {
  const user = await obtenerUsuario(ctx.telefono);
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
