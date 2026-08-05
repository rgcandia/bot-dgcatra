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

client.on('qr', (qr) => {
  console.log('📱 [WhatsApp] Nuevo QR generado');
  qrcode.generate(qr, { small: true });
  emitQR(qr);
});

client.on('ready', () => {
  const phone = client.info?.wid?._serialized?.split('@')[0] || 'Conectado';
  console.log(`✅ [WhatsApp] Conectado y listo! (${phone})`);
  setBotConnected(phone);
});

client.on('auth_failure', (msg) => {
  console.error('❌ [WhatsApp] Error de autenticación:', msg);
  setBotDisconnected();
});

client.on('disconnected', (reason) => {
  console.log(`⚠️ [WhatsApp] Desconectado: ${reason}`);
  setBotDisconnected();
});

client.on('message', async (msg) => {
  if (msg.from === 'status@broadcast') return;
  console.log(`📩 De: ${msg.from} · ${msg.body || '(archivo/multimedia)'}`);
  await procesarMensaje(msg);
});

client.initialize();

export { client };
