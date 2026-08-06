import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { procesarMensaje } from './index.js';
import { setClient } from './enviar.js';
import { setBotConnected, setBotDisconnected, emitQR } from '../socket/server.js';

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
    console.log(`🔄 [WhatsApp] Intento de reconexión ${reintentos}/${MAX_REINTENTOS}`);
    await new Promise(r => setTimeout(r, ESPERA_REINTENTO));

    try {
      await client.initialize();
      return; // ready event se encargará de resetear
    } catch (e: any) {
      console.warn(`⚠️ [WhatsApp] Reintento ${reintentos} falló:`, e?.message || e);
    }
  }

  console.error('❌ [WhatsApp] Se agotaron los reintentos. Se necesita escanear QR manualmente.');
  reconectando = false;
}

client.on('qr', (qr) => {
  console.log('📱 [WhatsApp] Nuevo QR generado');
  qrcode.generate(qr, { small: true });
  emitQR(qr);
  reconectando = false;
});

client.on('ready', () => {
  reintentos = 0;
  reconectando = false;
  const phone = client.info?.wid?._serialized?.split('@')[0] || 'Conectado';
  console.log(`✅ [WhatsApp] Conectado y listo! (${phone})`);
  setBotConnected(phone);
});

client.on('auth_failure', (msg) => {
  console.error('❌ [WhatsApp] Error de autenticación:', msg);
  setBotDisconnected();
  reintentos = MAX_REINTENTOS; // no reintentar, sesión inválida
});

client.on('disconnected', (reason) => {
  console.log(`⚠️ [WhatsApp] Desconectado: ${reason}`);
  setBotDisconnected();
  intentarReconectar();
});

client.on('message', async (msg) => {
  if (msg.from === 'status@broadcast') return;
  console.log(`📩 De: ${msg.from} · ${msg.body || '(archivo/multimedia)'}`);
  await procesarMensaje(msg);
});

client.initialize();

export { client };
