import { Ticket, User } from '../../models/models.js';
import { getIO } from '../../socket/server.js';
import { enviarTexto, enviarBotones } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';
import { esCercano, esCortesia } from '../helpers.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

type PendingCmd = 'cerrar' | 'verTicket';

export async function manejarComandos(ctx: Ctx): Promise<boolean> {
  const texto = ctx.texto.toLowerCase().trim();

  // Si hay un comando pendiente
  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  const pending = ctxData.pendingCommand as PendingCmd | undefined;

  if (pending) {
    // Esperando la solución (ya pidió cerrar con número)
    if (pending === 'cerrar' && ctxData.ticketId != null) {
      if (texto === 'cancelar' || texto === 'salir' || esCercano(texto, 'cancelar')) {
        await guardarUsuario(ctx.telefono, { context: null });
        await enviarTexto(ctx.telefono, 'Cancelado. El ticket sigue como estaba. Escribí *ayuda* para ver los comandos.');
        return true;
      }
      const solucion = ctx.texto.trim();
      if (solucion.length < 3) {
        await enviarTexto(ctx.telefono, '❌ Contame un poco más cómo se resolvió (mínimo 3 caracteres):');
        return true;
      }
      await guardarUsuario(ctx.telefono, { context: null });
      return await cerrarConSolucion(ctx.telefono, ctxData.ticketId, solucion);
    }

    // Esperando un número
    if (texto === 'cancelar' || esCercano(texto, 'cancelar')) {
      await guardarUsuario(ctx.telefono, { context: null });
      await enviarTexto(ctx.telefono, 'Cancelado. Escribí *ayuda* para ver los comandos.');
      return true;
    }
    const num = parseInt(texto);
    if (!isNaN(num) && num > 0) {
      if (pending === 'cerrar') {
        return await pedirSolucion(ctx.telefono, num);
      }
      await guardarUsuario(ctx.telefono, { context: null });
      return await ejecutarPendiente(ctx.telefono, pending, num);
    }
    await enviarTexto(ctx.telefono, `❌ Escribí el número de ticket o *cancelar* para salir.`);
    return true;
  }

  // Menú
  if (texto === 'hola' || texto === 'menu' || texto === 'buenas' || texto === 'buenos dias' || texto === 'buenas tardes') {
    return await mostrarMenu(ctx.telefono);
  }

  // Botones numéricos del menú
  if (ctx.buttonId === 'cmd_ticket') return false; // → inicia creación de ticket
  if (ctx.buttonId === 'cmd_mis_tickets') return await mostrarTickets(ctx.telefono);

  // Iniciar ticket por texto
  if (texto === 'nuevo ticket' || texto === 'crear ticket' || texto === 'crear' || texto === 'reportar' || texto === 'problema' || texto === 'incidente' || texto === 'falla' || texto === 'reporte') {
    return false; // → inicia creación de ticket
  }

  // Ayuda
  if (texto === 'ayuda' || texto === 'help' || texto === 'comandos' || esCercano(texto, 'ayuda') || ctx.buttonId === 'cmd_ayuda') {
    return await mostrarAyuda(ctx.telefono);
  }

  // cancelar global (sin pendiente)
  if (texto === 'cancelar' || esCercano(texto, 'cancelar')) {
    await enviarTexto(ctx.telefono, 'Ok. Escribí *ayuda* para ver los comandos.');
    return true;
  }

  // tickets / mis tickets (vista rápida)
  if (texto === 'tickets' || texto === 'mis tickets' || texto === '/tickets' || texto === '/mis-tickets' ||
      (esCercano(texto, 'tickets') && texto !== 'ticket') || esCercano(texto, 'mis tickets')) {
    return await mostrarTickets(ctx.telefono);
  }

  // /ticket #N o ticket #N (con número)
  const ticketConNum = texto.match(/^(?:\/ticket|ticket|ver\s+ticket)\s+#?(\d+)$/i);
  if (ticketConNum) {
    return await mostrarTicket(ctx.telefono, parseInt(ticketConNum[1]));
  }

  // cerrar N / cerrar ticket N / cancelar N / cancelar ticket N
  const cerrarConNum = texto.match(/^(?:\/cerrar|cerrar|cancelar)(?:\s+ticket)?\s+#?(\d+)$/i);
  if (cerrarConNum) {
    return await pedirSolucion(ctx.telefono, parseInt(cerrarConNum[1]));
  }

  // ── Comandos sin número → pedir número ──
  if (texto === 'cerrar') {
    await guardarUsuario(ctx.telefono, { context: { pendingCommand: 'cerrar' } });
    await enviarTexto(ctx.telefono, '🔒 ¿Qué ticket querés *cerrar*?\nEscribí el número. Para cancelar, escribí *cancelar*.');
    return true;
  }

  if (texto === 'ticket' || texto === 'ver ticket' || texto === 'ver') {
    await guardarUsuario(ctx.telefono, { context: { pendingCommand: 'verTicket' } });
    await enviarTexto(ctx.telefono, '🔍 ¿Qué ticket querés *ver*?\nEscribí el número. Para cancelar, escribí *cancelar*.');
    return true;
  }

  if (esCortesia(texto)) {
    await enviarTexto(ctx.telefono, '😊 ¡De nada! Si necesitás algo más, escribí *ayuda* para ver los comandos.');
    return true;
  }

  return false;
}

async function ejecutarPendiente(telefono: string, cmd: PendingCmd, id: number): Promise<boolean> {
  switch (cmd) {
    case 'cerrar':
      return await pedirSolucion(telefono, id);
    case 'verTicket':
      return await mostrarTicket(telefono, id);
  }
}

async function mostrarMenu(telefono: string): Promise<boolean> {
  return await enviarBotones(telefono,
    '👋 ¡Hola! ¿En qué te puedo ayudar?\n\n' +
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
    '🔍 *ticket N* — consulta un ticket\n' +
    '✅ *cerrar N* — cerrar un ticket (te pide cómo se resolvió)\n\n' +
    'También podés escribir solo *cerrar* o *ticket*\n' +
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
  msg += 'Para ver uno, escribí *ticket N*\n';
  msg += 'Para cerrar uno, escribí *cerrar N*';

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
  if (ticket.estado === 'abierto' || ticket.estado === 'en_proceso') {
    acciones = `\n\nPara cerrarlo, escribí *cerrar ${ticket.id}*`;
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

async function pedirSolucion(telefono: string, ticketId: number): Promise<boolean> {
  const ticket = await Ticket.findOne({ where: { id: ticketId, userTelefono: telefono } });
  if (!ticket) {
    await enviarTexto(telefono, `❌ No encontré el ticket #${ticketId} o no es tuyo.`);
    return true;
  }

  if (ticket.estado === 'cerrado') {
    await enviarTexto(telefono, `⚠️ El ticket #${ticketId} ya está cerrado.`);
    return true;
  }

  await guardarUsuario(telefono, { context: { pendingCommand: 'cerrar', ticketId } });
  await enviarTexto(telefono,
    `🔧 ¿Se solucionó el *ticket #${ticketId}*? Contame qué pasó y cómo lo resolviste.\n\n` +
    `Escribí *cancelar* para no cerrarlo.`);
  return true;
}

async function cerrarConSolucion(telefono: string, ticketId: number, solucion: string): Promise<boolean> {
  const ticket = await Ticket.findOne({ where: { id: ticketId, userTelefono: telefono } });
  if (!ticket) {
    await enviarTexto(telefono, `❌ No encontré el ticket #${ticketId} o no es tuyo.`);
    return true;
  }

  if (ticket.estado === 'cerrado') {
    await enviarTexto(telefono, `⚠️ El ticket #${ticketId} ya está cerrado.`);
    return true;
  }

  const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];
  const user = await User.findByPk(telefono);
  const autor = user?.nombreCompleto || telefono;
  historial.push({ accion: `${autor} cerró el ticket`, autor, timestamp: new Date().toISOString() });
  ticket.estado = 'cerrado';
  ticket.solucion = solucion;

  ticket.historial = historial;
  ticket.changed('historial', true);
  await ticket.save();

  const io = getIO();
  if (io) io.emit('ticket-actualizado', ticket);

  await enviarTexto(telefono,
    `✅ *Ticket #${ticketId}*: "${ticket.asunto}" cerrado\n\n` +
    `🔧 Solución: ${solucion}\n\n` +
    `Escribí *ayuda* para ver el menú.`,
    ticketId);
  return true;
}
