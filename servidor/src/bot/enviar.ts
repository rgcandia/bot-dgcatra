import type { Client } from 'whatsapp-web.js';
import { registrarMensajeSaliente, guardarUltimosBotones } from './session.js';

let _client: Client | null = null;
let _ready = false;

const chatIdCache = new Map<string, string>();
const lastSend = new Map<string, number>();
const RATE_LIMIT_MS = 2000;

export function setClient(c: Client) {
  _client = c;
  c.on('ready', () => { _ready = true; });
}

export function registrarChatId(numeroLimpio: string, chatId: string) {
  chatIdCache.set(numeroLimpio, chatId);
}

function formatearChatId(telefono: string): string {
  if (chatIdCache.has(telefono)) return chatIdCache.get(telefono)!;
  if (telefono.includes('@')) return telefono;
  let num = telefono.replace(/[^\d]/g, '');
  if (num.startsWith('+')) num = num.slice(1);
  if (chatIdCache.has(num)) return chatIdCache.get(num)!;
  return `${num}@c.us`;
}

async function esperarCliente(): Promise<Client> {
  if (_ready && _client) return _client;
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (_ready && _client) { clearInterval(check); resolve(_client); }
    }, 500);
  });
}

async function simularEscritura(chatId: string, texto: string): Promise<void> {
  try {
    const client = await esperarCliente();
    await client.pupPage!.evaluate(async (id: string) => {
      const WidFactory = window.require('WAWebWidFactory');
      const ChatState = window.require('WAWebChatStateBridge');
      await ChatState.sendChatStateComposing(WidFactory.createWid(id));
    }, chatId);
    const delay = 1500 + texto.length * 15 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));
  } catch (e: any) {
    console.warn('⚠️ [Typing] Error al simular escritura:', e?.message || e);
    const delay = 1500 + Math.random() * 2000;
    await new Promise(r => setTimeout(r, delay));
  }
}

async function rateLimitar(telefono: string): Promise<void> {
  const now = Date.now();
  const ultimo = lastSend.get(telefono) || 0;
  const espera = RATE_LIMIT_MS - (now - ultimo);
  if (espera > 0) {
    await new Promise(r => setTimeout(r, espera));
  }
  lastSend.set(telefono, Date.now());
}

export interface BtnDef {
  id: string;
  title: string;
}

export async function enviarTexto(to: string, texto: string): Promise<boolean> {
  try {
    const chatId = formatearChatId(to);
    await simularEscritura(chatId, texto);

    const client = await esperarCliente();
    await rateLimitar(to);
    await client.sendMessage(chatId, texto);

    registrarMensajeSaliente(to, texto);
    return true;
  } catch (e) {
    console.error('❌ Error enviando texto:', e);
    return false;
  }
}

export async function enviarBotones(to: string, body: string, buttons: BtnDef[]): Promise<boolean> {
  try {
    const emojis = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣'];
    const opts = buttons.map((b, i) => `${emojis[i] || `${i + 1}.`} *${b.title}*`).join('\n');
    const msg = `${body}\n\n${opts}`;

    guardarUltimosBotones(to, buttons);
    const chatId = formatearChatId(to);
    await simularEscritura(chatId, msg);

    const client = await esperarCliente();
    await rateLimitar(to);
    await client.sendMessage(chatId, msg);

    registrarMensajeSaliente(to, msg);
    return true;
  } catch (e) {
    console.error('❌ Error enviando botones:', e);
    return false;
  }
}

export async function enviarLista(
  to: string,
  body: string,
  _buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
): Promise<boolean> {
  try {
    const chatId = formatearChatId(to);
    const emojis = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣', '🔟'];

    let msg = `${body}\n\n`;
    let idx = 0;
    const allRows: BtnDef[] = [];
    for (const sec of sections) {
      msg += `*${sec.title}*\n`;
      for (const row of sec.rows) {
        msg += `${emojis[idx] || `${idx + 1}.`} ${row.title}\n`;
        if (row.description) msg += `   ${row.description}\n`;
        allRows.push({ id: row.id, title: row.title });
        idx++;
      }
      msg += '\n';
    }
    guardarUltimosBotones(to, allRows);

    await simularEscritura(chatId, msg);
    const client = await esperarCliente();
    await rateLimitar(to);
    await client.sendMessage(chatId, msg);

    registrarMensajeSaliente(to, body);
    return true;
  } catch (e) {
    console.error('❌ Error enviando lista:', e);
    return false;
  }
}
