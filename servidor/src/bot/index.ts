import type { Transaction } from 'sequelize';
import { User } from '../models/models.js';
import { manejarRegistro } from './registro.js';

export async function procesarMensaje(payload: any, messageId?: string) {
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

  const procesado = await manejarRegistro({
    telefono: from,
    texto: text,
    buttonId,
  });

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

  if (texto === 'hola' || texto === 'menu' || texto === 'ayuda') {
    await enviarBotones(
      ctx.telefono,
      '👋 *Hola!* ¿Qué querés hacer?\n\n' +
      'Podés usar estos comandos:\n' +
      '• */ticket* - Abrir un ticket\n' +
      '• */mis-tickets* - Ver mis tickets\n' +
      '• */cerrar* - Cerrar ticket\n' +
      '• */ayuda* - Ver este menú',
      [
        { id: 'cmd_ticket', title: '🎫 Nuevo ticket' },
        { id: 'cmd_mis_tickets', title: '📋 Mis tickets' },
        { id: 'cmd_ayuda', title: '❓ Ayuda' },
      ]
    );
    return;
  }

  if (texto.startsWith('/ticket')) {
    await enviarTexto(ctx.telefono, '📝 *Nuevo ticket*\n\nDescribí el problema en un mensaje:');
    return;
  }

  if (texto === '/mis-tickets' || ctx.buttonId === 'cmd_mis_tickets') {
    await enviarTexto(ctx.telefono, '📋 *Tus tickets* (próximamente)');
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
