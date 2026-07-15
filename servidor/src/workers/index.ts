import 'dotenv/config';
import { sequelize } from '../models/models.js';
import { createWorker } from '../queue/index.js';
import { procesarMensaje } from '../bot/index.js';

await sequelize.sync();
console.log('🗄️ Base de datos sincronizada');

const worker = createWorker(async (job) => {
  const { payload, messageId } = job.data;

  console.log(`⚙️ Worker procesando job ${job.id}`);
  console.log(`   Message ID: ${messageId || 'N/A'}`);

  try {
    await procesarMensaje(payload, messageId);
  } catch (e) {
    console.error('   ❌ Error procesando mensaje:', e);
  }
});

console.log('🧑‍🏭 Workers iniciados, esperando mensajes...');
