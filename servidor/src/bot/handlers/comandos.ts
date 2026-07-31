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
    return false;
  }

  if (texto === '/mis-tickets' || ctx.buttonId === 'cmd_mis_tickets') {
    return await mostrarTickets(ctx.telefono);
  }

  return await mostrarNoEntendido(ctx.telefono);
}

async function mostrarMenu(telefono: string): Promise<boolean> {
  return await enviarBotones(telefono,
    '👋 *Hola!* ¿Qué querés hacer?\n\n' +
    '🎫 *Nuevo ticket* — Reportar un problema\n' +
    '📋 *Mis tickets* — Ver tus reportes\n' +
    '❓ *Ayuda* — Ver este menú',
    [
      { id: 'cmd_ticket', title: 'Nuevo ticket' },
      { id: 'cmd_mis_tickets', title: 'Mis tickets' },
      { id: 'cmd_ayuda', title: 'Ayuda' },
    ],
    'Menú principal',
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
    'Ayuda',
  );
}
