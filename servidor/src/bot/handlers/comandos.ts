import { Ticket } from '../../models/models.js';
import { getIO } from '../../socket/server.js';
import { enviarTexto, enviarBotones } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

type PendingCmd = 'cerrar' | 'reabrir' | 'cancelarTicket' | 'verTicket';

export async function manejarComandos(ctx: Ctx): Promise<boolean> {
  const texto = ctx.texto.toLowerCase().trim();

  // Si hay un comando pendiente (pidió número)
  const user = await obtenerUsuario(ctx.telefono);
  const pending = (user.context as any)?.pendingCommand as PendingCmd | undefined;

  if (pending) {
    if (texto === 'cancelar') {
      await guardarUsuario(ctx.telefono, { context: null });
      await enviarTexto(ctx.telefono, 'Cancelado. Escribí *ayuda* para ver los comandos.');
      return true;
    }
    const num = parseInt(texto);
    if (!isNaN(num) && num > 0) {
      await guardarUsuario(ctx.telefono, { context: null });
      return await ejecutarPendiente(ctx.telefono, pending, num);
    }
    await enviarTexto(ctx.telefono, `❌ Escribí el número de ticket o *cancelar* para salir.`);
    return true;
  }

  // Menú
  if (texto === 'hola' || texto === 'menu' || texto === 'buenas' || texto === 'buenos dias' || texto === 'buenas tardes' ||
      ctx.buttonId === 'cmd_ticket' || ctx.buttonId === 'cmd_mis_tickets') {
    return await mostrarMenu(ctx.telefono);
  }

  // Ayuda
  if (texto === 'ayuda' || texto === 'help' || texto === 'comandos' || ctx.buttonId === 'cmd_ayuda') {
    return await mostrarAyuda(ctx.telefono);
  }

  // cancelar global (sin pendiente)
  if (texto === 'cancelar') {
    await enviarTexto(ctx.telefono, 'Ok. Escribí *ayuda* para ver los comandos.');
    return true;
  }

  // tickets / mis tickets (vista rápida)
  if (texto === 'tickets' || texto === 'mis tickets' || texto === '/tickets' || texto === '/mis-tickets') {
    return await mostrarTickets(ctx.telefono);
  }

  // /ticket #N o ticket #N (con número)
  const ticketConNum = texto.match(/^(?:\/ticket|ticket|ver\s+ticket)\s+#?(\d+)$/i);
  if (ticketConNum) {
    return await mostrarTicket(ctx.telefono, parseInt(ticketConNum[1]));
  }

  // cerrar #N o cerrar ticket #N (con número)
  const cerrarConNum = texto.match(/^(?:\/cerrar|cerrar(?:\s+ticket)?)\s+#?(\d+)$/i);
  if (cerrarConNum) {
    return await cambiarEstado(ctx.telefono, parseInt(cerrarConNum[1]), 'cerrado');
  }

  // cancelar ticket #N (con número)
  const cancelarConNum = texto.match(/^cancelar\s+ticket\s+#?(\d+)$/i);
  if (cancelarConNum) {
    return await cambiarEstado(ctx.telefono, parseInt(cancelarConNum[1]), 'cerrado');
  }

  // reabrir #N o reabrir ticket #N (con número)
  const reabrirConNum = texto.match(/^(?:\/reabrir|reabrir(?:\s+ticket)?)\s+#?(\d+)$/i);
  if (reabrirConNum) {
    return await cambiarEstado(ctx.telefono, parseInt(reabrirConNum[1]), 'abierto');
  }

  // ── Comandos sin número → pedir número ──
  if (texto === 'cerrar') {
    await guardarUsuario(ctx.telefono, { context: { pendingCommand: 'cerrar' } });
    await enviarTexto(ctx.telefono, '🔒 ¿Qué ticket querés *cerrar*?\nEscribí el número. Para cancelar, escribí *cancelar*.');
    return true;
  }

  if (texto === 'reabrir') {
    await guardarUsuario(ctx.telefono, { context: { pendingCommand: 'reabrir' } });
    await enviarTexto(ctx.telefono, '🔄 ¿Qué ticket querés *reabrir*?\nEscribí el número. Para cancelar, escribí *cancelar*.');
    return true;
  }

  if (texto === 'cancelar ticket') {
    await guardarUsuario(ctx.telefono, { context: { pendingCommand: 'cancelarTicket' } });
    await enviarTexto(ctx.telefono, '❌ ¿Qué ticket querés *cancelar*?\nEscribí el número. Para cancelar, escribí *cancelar*.');
    return true;
  }

  if (texto === 'ticket' || texto === 'ver ticket' || texto === 'ver') {
    await guardarUsuario(ctx.telefono, { context: { pendingCommand: 'verTicket' } });
    await enviarTexto(ctx.telefono, '🔍 ¿Qué ticket querés *ver*?\nEscribí el número. Para cancelar, escribí *cancelar*.');
    return true;
  }

  return false;
}

async function ejecutarPendiente(telefono: string, cmd: PendingCmd, id: number): Promise<boolean> {
  switch (cmd) {
    case 'cerrar':
    case 'cancelarTicket':
      return await cambiarEstado(telefono, id, 'cerrado');
    case 'reabrir':
      return await cambiarEstado(telefono, id, 'abierto');
    case 'verTicket':
      return await mostrarTicket(telefono, id);
  }
}

async function mostrarMenu(telefono: string): Promise<boolean> {
  return await enviarBotones(telefono,
    '👋 *Hola!* ¿Qué querés hacer?\n\n' +
    'Escribí el número de la opción:',
    [
      { id: 'cmd_ticket', title: 'Nuevo ticket' },
      { id: 'cmd_mis_tickets', title: 'Ver mis tickets' },
      { id: 'cmd_ayuda', title: 'Ayuda' },
      { id: 'cancelar', title: 'Cancelar' },
    ],
  );
}

async function mostrarAyuda(telefono: string): Promise<boolean> {
  return await enviarTexto(telefono,
    'ℹ️ *Comandos disponibles*\n\n' +
    '🎫 *Nuevo ticket* — crea un ticket\n' +
    '📋 *tickets* — ve tus últimos tickets\n' +
    '🔍 *ticket #N* — consulta un ticket\n' +
    '✅ *cerrar #N* — cerrar un ticket resuelto\n' +
    '❌ *cancelar ticket #N* — cancelar un ticket\n' +
    '🔄 *reabrir #N* — reabrir un ticket cerrado\n\n' +
    'También podés escribir solo *cerrar*, *reabrir* o *ticket*\n' +
    'y te pido el número.\n\n' +
    'Escribí *ayuda* para ver esto de nuevo.');
}

async function mostrarTickets(telefono: string): Promise<boolean> {
  const tickets = await Ticket.findAll({
    where: { userTelefono: telefono },
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  if (tickets.length === 0) {
    await enviarTexto(telefono, '📋 No tenés tickets registrados todavía.');
    return true;
  }

  let msg = '📋 *Tus últimos tickets:*\n\n';
  tickets.forEach(t => {
    const estado = t.estado === 'abierto' ? '🔴' : t.estado === 'en_proceso' ? '🟡' : '✅';
    msg += `${estado} *Ticket #${t.id}* — ${(t.asunto || '').substring(0, 50)}\n`;
    msg += `   Estado: ${t.estado.replace('_', ' ')} · ${new Date(t.createdAt).toLocaleDateString('es-AR')}\n\n`;
  });
  msg += 'Para ver uno, escribí *ticket #N*\n';
  msg += 'Para cerrar uno, escribí *cerrar #N*';

  await enviarTexto(telefono, msg);
  return true;
}

async function mostrarTicket(telefono: string, id: number): Promise<boolean> {
  const ticket = await Ticket.findOne({ where: { id, userTelefono: telefono } });
  if (!ticket) {
    await enviarTexto(telefono, `❌ No encontré el ticket #${id}.\nAsegurate de que sea tuyo y el número sea correcto.`);
    return true;
  }

  const estadoIcon = ticket.estado === 'abierto' ? '🔴' : ticket.estado === 'en_proceso' ? '🟡' : '✅';
  const historial = (Array.isArray(ticket.historial) ? ticket.historial : []).slice(-3);
  const histStr = historial.length > 0
    ? '\n\n📜 *Últimos cambios:*\n' + historial.map((h: any) =>
        `   ${new Date(h.timestamp).toLocaleDateString('es-AR')} — ${h.accion}`
      ).join('\n')
    : '';

  let acciones = '';
  if (ticket.estado === 'en_proceso') {
    acciones = `\n\nSi ya se solucionó, escribí *cerrar #${ticket.id}*`;
  } else if (ticket.estado === 'cerrado') {
    acciones = `\n\nSi necesitás reabrirlo, escribí *reabrir #${ticket.id}*`;
  }

  const msg = `${estadoIcon} *Ticket #${ticket.id}*\n\n` +
    `📝 ${ticket.asunto}\n` +
    `📍 ${ticket.ubicacion || 'No especificada'}\n` +
    `⚡ Prioridad: ${ticket.prioridad}\n` +
    `📅 ${new Date(ticket.createdAt).toLocaleDateString('es-AR')}\n` +
    `${ticket.solucion ? `\n🔧 Solución: ${(ticket.solucion as string).substring(0, 200)}` : ''}` +
    histStr +
    acciones;

  await enviarTexto(telefono, msg);
  return true;
}

async function cambiarEstado(telefono: string, ticketId: number, estado: 'abierto' | 'cerrado'): Promise<boolean> {
  const ticket = await Ticket.findOne({ where: { id: ticketId, userTelefono: telefono } });
  if (!ticket) {
    await enviarTexto(telefono, `❌ No encontré el ticket #${ticketId} o no es tuyo.`);
    return true;
  }

  if (ticket.estado === estado) {
    const labels: Record<string, string> = { abierto: 'abierto', cerrado: 'cerrado' };
    await enviarTexto(telefono, `⚠️ El ticket #${ticketId} ya está ${labels[estado]}.`);
    return true;
  }

  if (estado === 'abierto' && ticket.estado !== 'cerrado') {
    await enviarTexto(telefono, `⚠️ Solo podés reabrir tickets que están cerrados.\nEl ticket #${ticketId} está *${ticket.estado.replace('_', ' ')}*.`);
    return true;
  }

  if (estado === 'cerrado' && ticket.estado === 'abierto') {
    await enviarTexto(telefono, `⚠️ El ticket #${ticketId} todavía no fue tomado por un técnico.\nEsperá a que esté *en proceso* para cerrarlo.`);
    return true;
  }

  const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];
  const autor = 'Agente';
  if (estado === 'cerrado') {
    historial.push({ accion: 'El agente cerró el ticket', autor, timestamp: new Date().toISOString() });
    ticket.estado = 'cerrado';
  } else {
    historial.push({ accion: 'El agente reabrió el ticket', autor, timestamp: new Date().toISOString() });
    ticket.estado = 'abierto';
  }

  ticket.historial = historial;
  ticket.changed('historial', true);
  await ticket.save();

  const io = getIO();
  if (io) io.emit('ticket-actualizado', ticket);

  const label = estado === 'cerrado' ? '*cerrado* ✅' : '*reabierto* 🔴';
  await enviarTexto(telefono,
    `✅ *Ticket #${ticketId} ${label}*\n\n` +
    (estado === 'cerrado'
      ? `Si necesitás reabrirlo, escribí *reabrir #${ticketId}*.`
      : `Un técnico va a revisarlo nuevamente.\nEscribí *ayuda* para ver el menú.`),
    ticketId);
  return true;
}
