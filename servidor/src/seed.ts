import 'dotenv/config';
import { sequelize, Base } from './models/models.js';

async function seed() {
  await sequelize.sync({ force: true });

  await Base.create({ nombre: 'Base Piedras', direccion: 'Av. Piedras 123', tipo: 'base' });
  await Base.create({ nombre: 'Base Once', direccion: 'Av. Rivadavia 456', tipo: 'base' });

  console.log('✅ Seed completado');
  await sequelize.close();
}

seed().catch((e) => {
  console.error('❌ Error en seed:', e);
  process.exit(1);
});
