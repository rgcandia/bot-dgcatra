import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { procesarMensaje } from './index.js';
import { enviarTexto } from './enviar.js';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'dgcatra' }),
  puppeteer: {
    headless: true,
    dumpio: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
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

client.on('qr', (qr) => {
  console.log('📱 [WhatsApp] Escaneá el QR para conectar:');
  qrcode.generate(qr, { small: true });
  console.log('🔄 También disponible en: http://localhost:4002/api/whatsapp/qr');
});

client.on('ready', () => {
  console.log('✅ [WhatsApp] Conectado y listo!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ [WhatsApp] Error de autenticación:', msg);
  console.log('🔄 Eliminá la sesión y escaneá el QR de nuevo.');
});

client.on('disconnected', (reason) => {
  console.log(`⚠️ [WhatsApp] Desconectado: ${reason}`);
});

client.on('message', async (msg) => {
  if (msg.from === 'status@broadcast') return;

  const originalReply = msg.reply.bind(msg);
  msg.reply = async (content: any) => {
    try {
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    } catch { }
    return originalReply(content);
  };

  console.log(`📩 De: ${msg.from} · ${msg.body || '(archivo/multimedia)'}`);
  await procesarMensaje(msg);
});

client.initialize();

export { client };
