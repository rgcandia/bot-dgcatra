import pkg from 'whatsapp-web.js';
import type { Client } from 'whatsapp-web.js';
const { Buttons, List } = pkg;
import { registrarMensajeSaliente } from './session.js';

let _client: Client | null = null;
let _ready = false;

const chatIdCache = new Map<string, string>();

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

async function simularEscritura(chatId: string): Promise<void> {
  try {
    const client = await esperarCliente();
    const chat = await client.getChatById(chatId);
    await chat.sendStateTyping();
    const delay = 1500 + Math.random() * 2500;
    await new Promise(r => setTimeout(r, delay));
  } catch { }
}

export interface BtnDef {
  id: string;
  title: string;
}

export async function enviarTexto(to: string, texto: string): Promise<boolean> {
  try {
    const chatId = formatearChatId(to);
    await simularEscritura(chatId);

    const client = await esperarCliente();
    await client.sendMessage(chatId, texto);

    registrarMensajeSaliente(to, texto);
    return true;
  } catch (e) {
    console.error('❌ Error enviando texto:', e);
    return false;
  }
}

export async function enviarBotones(
  to: string,
  body: string,
  buttons: BtnDef[],
  title?: string,
  footer?: string,
): Promise<boolean> {
  try {
    const chatId = formatearChatId(to);
    await simularEscritura(chatId);

    const client = await esperarCliente();
    const mapped = buttons.slice(0, 3).map(b => ({ id: b.id, body: b.title }));
    const btns = new Buttons(body, mapped, title, footer);
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
  msgTitle?: string,
  footer?: string,
): Promise<boolean> {
  try {
    const chatId = formatearChatId(to);
    await simularEscritura(chatId);

    const client = await esperarCliente();
    const list = new List(body, buttonText, sections, msgTitle, footer);
    await client.sendMessage(chatId, list);

    registrarMensajeSaliente(to, body);
    return true;
  } catch (e) {
    console.error('❌ Error enviando lista:', e);
    return false;
  }
}
