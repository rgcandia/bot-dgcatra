import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { procesarMensaje } from './index.js';
import { setClient } from './enviar.js';
import { setBotConnected, setBotDisconnected, emitQR } from '../socket/server.js';
import { logger } from '../config/logger.js';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'dgcatra' }),
  puppeteer: {
    headless: true,
    dumpio: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

setClient(client);

let reintentos = 0;
const MAX_REINTENTOS = 5;
const ESPERA_REINTENTO = 30_000;
let reconectando = false;

async function intentarReconectar() {
  if (reconectando) return;
  reconectando = true;

  while (reintentos < MAX_REINTENTOS) {
    reintentos++;
    logger.warn(`Intento de reconexión ${reintentos}/${MAX_REINTENTOS}`);
    await new Promise(r => setTimeout(r, ESPERA_REINTENTO));

    try {
      await client.initialize();
      return;
    } catch (e: any) {
      logger.warn({ err: e?.message }, `Reintento ${reintentos} falló`);
    }
  }

  logger.error('Se agotaron los reintentos. Se necesita escanear QR manualmente.');
  reconectando = false;
}

client.on('qr', (qr) => {
  logger.info('Nuevo QR generado');
  qrcode.generate(qr, { small: true });
  emitQR(qr);
  reconectando = false;
});

client.on('ready', () => {
  reintentos = 0;
  reconectando = false;
  const phone = client.info?.wid?._serialized?.split('@')[0] || 'Conectado';
  logger.info(`WhatsApp conectado (${phone})`);
  setBotConnected(phone);
});

client.on('auth_failure', (msg) => {
  logger.error({ err: msg }, 'Error de autenticación');
  setBotDisconnected();
  reintentos = MAX_REINTENTOS;
});

client.on('disconnected', (reason) => {
  logger.warn(`WhatsApp desconectado: ${reason}`);
  setBotDisconnected();
  intentarReconectar();
});

client.on('message', async (msg) => {
  if (msg.from === 'status@broadcast') return;
  await procesarMensaje(msg);
});

client.initialize();

export { client };
