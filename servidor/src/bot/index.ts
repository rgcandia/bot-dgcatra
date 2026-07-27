import { User } from '../models/models.js';
import { manejarRegistro } from './registro.js';
import { manejarCreacionTicket } from './ticket.js';

export async function procesarMensaje(payload: any) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) {
    console.log('   ℹ️ No hay mensaje en el payload (puede ser un status update)');
    return;
  }

  const from = message.from;
  const text = message.text?.body || '';
  const buttonId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;
  const timestamp = message.timestamp;

  console.log(`   📩 De: ${from}`);
  console.log(`   💬 Mensaje: ${text || '(botón)'}`);
  if (buttonId) console.log(`   🔘 Botón: ${buttonId}`);
  console.log(`   🕒 Timestamp: ${timestamp}`);

  const user = await User.findByPk(from);
  const textoLower = text.toLowerCase().trim();

  if (user?.registroCompleto) {
    await manejarUsuarioRegistrado({ telefono: from, texto: text, buttonId });
    return;
  }

  if (textoLower === 'hola' || textoLower === 'menu' || textoLower === 'ayuda' || textoLower === 'start') {
    await User.upsert({
      telefono: from,
      pasoRegistro: 0,
      context: null,
      registroCompleto: false,
    });
  }

  const procesado = await manejarRegistro({ telefono: from, texto: text, buttonId });

  if (!procesado) {
    const { enviarTexto } = await import('./enviar.js');
    const paso = (await User.findByPk(from))?.pasoRegistro ?? 0;
    if (paso === 0) {
      await enviarTexto(from, '👋 Escribí *hola* para comenzar el registro.');
    }
  }
}

async function manejarUsuarioRegistrado(ctx: { telefono: string; texto: string; buttonId?: string }) {
  const { enviarTexto, enviarBotones } = await import('./enviar.js');
  const texto = ctx.texto.toLowerCase().trim();

  if (texto === 'cancelar') {
    await enviarTexto(ctx.telefono, 'Ok. Escribí *ayuda* para ver el menú.');
    return;
  }

  const user = await User.findByPk(ctx.telefono);
  const context = (user?.context || {}) as any;

  if (context.ticketPaso !== undefined) {
    await manejarCreacionTicket(ctx);
    return;
  }

  if (texto === 'hola' || texto === 'menu' || texto === 'ayuda' || ctx.buttonId === 'cmd_ayuda') {
    await enviarBotones(
      ctx.telefono,
      '👋 *Hola!* ¿Qué querés hacer?\n\n' +
      '• 🎫 *Nuevo ticket* - Reportar un problema\n' +
      '• 📋 *Mis tickets* - Ver tus reportes\n' +
      '• ❓ *Ayuda* - Ver este menú',
      [
        { id: 'cmd_ticket', title: '🎫 Nuevo ticket' },
        { id: 'cmd_mis_tickets', title: '📋 Mis tickets' },
        { id: 'cmd_ayuda', title: '❓ Ayuda' },
      ]
    );
    return;
  }

  if (texto.startsWith('/ticket') || ctx.buttonId === 'cmd_ticket') {
    await manejarCreacionTicket(ctx);
    return;
  }

  if (texto === '/mis-tickets' || ctx.buttonId === 'cmd_mis_tickets') {
    const tickets = await (await import('../models/models.js')).Ticket.findAll({
      where: { userTelefono: ctx.telefono },
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    if (tickets.length === 0) {
      await enviarTexto(ctx.telefono, '📋 No tenés tickets registrados todavía.');
      return;
    }

    let msg = '📋 *Tus últimos tickets:*\n\n';
    tickets.forEach(t => {
      const estado = t.estado === 'abierto' ? '🔴' : t.estado === 'en_proceso' ? '🟡' : '✅';
      msg += `${estado} *Ticket #${t.id}* — ${(t.asunto || '').substring(0, 50)}\n`;
      msg += `   Estado: ${t.estado.replace('_', ' ')} · ${new Date(t.createdAt).toLocaleDateString('es-AR')}\n\n`;
    });
    await enviarTexto(ctx.telefono, msg);
    return;
  }

  await enviarBotones(
    ctx.telefono,
    '🤖 No entendí ese comando.\nEscribí *ayuda* para ver las opciones disponibles.',
    [
      { id: 'cmd_ayuda', title: '❓ Ayuda' },
    ]
  );
}
