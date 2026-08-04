import pkg from 'whatsapp-web.js';
import type { Client } from 'whatsapp-web.js';
const { List, Buttons } = pkg;
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
    const chatId = formatearChatId(to);
    await simularEscritura(chatId, body);

    const client = await esperarCliente();
    await rateLimitar(to);

    guardarUltimosBotones(to, buttons);
    const btns = new Buttons(body, buttons.slice(0, 3).map(b => ({ id: b.id, body: b.title })));
    await client.sendMessage(chatId, btns);

    registrarMensajeSaliente(to, body);
    return true;
  } catch (e) {
    console.error('❌ Error enviando botones:', e);
    return false;
  }
}

export async function enviarLista(
  to: string,
  body: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
): Promise<boolean> {
  try {
    const chatId = formatearChatId(to);

    const allRows: BtnDef[] = []; 
    for (const sec of sections) {
      for (const row of sec.rows) {
        allRows.push({ id: row.id, title: row.title });
      }
    }
    guardarUltimosBotones(to, allRows);

    await simularEscritura(chatId, body);
    const client = await esperarCliente();
    await rateLimitar(to);

    const list = new List(body, buttonText, sections);
    await client.sendMessage(chatId, list);

    registrarMensajeSaliente(to, body);
    return true;
  } catch (e) {
    console.error('❌ Error enviando lista:', e);
    return false;
  }
}
