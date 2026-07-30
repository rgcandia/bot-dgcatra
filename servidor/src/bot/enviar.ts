import { client } from './whatsapp.js';

function formatearChatId(telefono: string): string {
  let num = telefono.replace(/[^\d]/g, '');
  if (num.startsWith('+')) num = num.slice(1);
  return `${num}@c.us`;
}

interface Button {
  id: string;
  title: string;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

let clientReady = false;
client.on('ready', () => { clientReady = true; });

function esperarCliente(): Promise<void> {
  if (clientReady) return Promise.resolve();
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (clientReady) { clearInterval(check); resolve(); }
    }, 500);
  });
}

export async function enviarTexto(to: string, texto: string): Promise<boolean> {
  await esperarCliente();
  try {
    const chatId = formatearChatId(to);
    await client.sendMessage(chatId, texto);
    return true;
  } catch (e) {
    console.error('❌ Error enviando texto:', e);
    return false;
  }
}

export async function enviarBotones(to: string, texto: string, buttons: Button[]): Promise<boolean> {
  await esperarCliente();
  try {
    const chatId = formatearChatId(to);
    if (buttons.length <= 3) {
      const btnList = buttons.map(b => ({
        body: b.title.length > 20 ? b.title.substring(0, 20) : b.title,
      }));
      await client.sendMessage(chatId, texto);
      for (const b of buttons) {
        await client.sendMessage(chatId, `👉 ${b.title}`);
      }
      return true;
    }
    return enviarTexto(to, texto + '\n\n' + buttons.map(b => `• ${b.title}`).join('\n'));
  } catch (e) {
    console.error('❌ Error enviando botones:', e);
    return false;
  }
}

export async function enviarLista(to: string, texto: string, botonLabel: string, rows: ListRow[]): Promise<boolean> {
  await esperarCliente();
  try {
    const chatId = formatearChatId(to);
    const lista = rows.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
    await client.sendMessage(chatId, `${texto}\n\n${lista}\n\nRespondé con el número de tu opción.`);
    return true;
  } catch (e) {
    console.error('❌ Error enviando lista:', e);
    return false;
  }
}
