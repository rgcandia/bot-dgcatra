import { Ticket } from '../../models/models.js';
import { enviarTexto, enviarBotones } from '../enviar.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

export async function manejarComandos(ctx: Ctx): Promise<boolean> {
  const texto = ctx.texto.toLowerCase().trim();

  if (texto === 'hola' || texto === 'menu' || texto === 'ayuda' || ctx.buttonId === 'cmd_ayuda') {
    return await mostrarMenu(ctx.telefono);
  }

  if (texto === 'cancelar') {
    await enviarTexto(ctx.telefono, 'Ok. Escribí *ayuda* para ver el menú.');
    return true;
  }

  if (texto.startsWith('/ticket') || ctx.buttonId === 'cmd_ticket') {
    const ticketMatch = texto.match(/^\/ticket\s+#?(\d+)$/i);
    if (ticketMatch) {
      return await mostrarTicket(ctx.telefono, parseInt(ticketMatch[1]));
    }
    return false;
  }

  if (texto === '/mis-tickets' || ctx.buttonId === 'cmd_mis_tickets') {
    return await mostrarTickets(ctx.telefono);
  }

  return false;
}

async function mostrarMenu(telefono: string): Promise<boolean> {
  return await enviarBotones(telefono,
    '👋 *Hola!* ¿Qué querés hacer?\n\n' +
    'Escribí el número de la opción:\n\n' +
    '1⃣ *Nuevo ticket* — Reportar un problema\n' +
    '2⃣ *Mis tickets* — Ver tus reportes\n' +
    '3⃣ *Ayuda* — Ver este menú',
    [
      { id: 'cmd_ticket', title: '1. Nuevo ticket' },
      { id: 'cmd_mis_tickets', title: '2. Mis tickets' },
      { id: 'cmd_ayuda', title: '3. Ayuda' },
    ],
  );
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

  await enviarTexto(telefono, msg);
  return true;
}

async function mostrarNoEntendido(telefono: string): Promise<boolean> {
  return await enviarBotones(telefono,
    '🤖 No entendí ese comando.\nEscribí *ayuda* para ver las opciones disponibles.',
    [{ id: 'cmd_ayuda', title: 'Ayuda' }],
  );
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

  const msg = `${estadoIcon} *Ticket #${ticket.id}*\n\n` +
    `📝 ${ticket.asunto}\n` +
    `📍 ${ticket.ubicacion || 'No especificada'}\n` +
    `⚡ Prioridad: ${ticket.prioridad}\n` +
    `📅 ${new Date(ticket.createdAt).toLocaleDateString('es-AR')}\n` +
    `${ticket.solucion ? `\n🔧 Solución: ${(ticket.solucion as string).substring(0, 200)}` : ''}` +
    histStr;

  await enviarTexto(telefono, msg);
  return true;
}
