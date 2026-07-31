import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { procesarMensaje } from './index.js';
import { setClient } from './enviar.js';

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
  console.log('📱 [WhatsApp] Escaneá el QR para conectar:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ [WhatsApp] Conectado y listo!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ [WhatsApp] Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
  console.log(`⚠️ [WhatsApp] Desconectado: ${reason}`);
});

client.on('message', async (msg) => {
  if (msg.from === 'status@broadcast') return;
  console.log(`📩 De: ${msg.from} · ${msg.body || '(archivo/multimedia)'}`);
  await procesarMensaje(msg);
});

client.initialize();

export { client };
