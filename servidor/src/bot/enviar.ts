import type { Client } from 'whatsapp-web.js';

let _client: Client | null = null;
let _ready = false;

export function setClient(c: Client) {
  _client = c;
  c.on('ready', () => { _ready = true; });
}

function formatearChatId(telefono: string): string {
  let num = telefono.replace(/[^\d]/g, '');
  if (num.startsWith('+')) num = num.slice(1);
  return `${num}@c.us`;
}

function esperarCliente(): Promise<void> {
  if (_ready && _client) return Promise.resolve();
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (_ready && _client) { clearInterval(check); resolve(); }
    }, 500);
  });
}

interface Button {
  id: string;
  title: string;
}

export async function enviarTexto(to: string, texto: string): Promise<boolean> {
  await esperarCliente();
  try {
    await _client!.sendMessage(formatearChatId(to), texto);
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
    await _client!.sendMessage(chatId, texto);
    for (const b of buttons) {
      await _client!.sendMessage(chatId, `👉 ${b.title}`);
    }
    return true;
  } catch (e) {
    console.error('❌ Error enviando botones:', e);
    return false;
  }
}

export async function enviarLista(to: string, texto: string, botonLabel: string, rows: { id: string; title: string; description?: string }[]): Promise<boolean> {
  await esperarCliente();
  try {
    const chatId = formatearChatId(to);
    const lista = rows.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
    await _client!.sendMessage(chatId, `${texto}\n\n${lista}\n\nRespondé con el número de tu opción.`);
    return true;
  } catch (e) {
    console.error('❌ Error enviando lista:', e);
    return false;
  }
}
