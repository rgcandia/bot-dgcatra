import 'dotenv/config';
import { sequelize, Base, Sector } from './models/models.js';

async function seed() {
  await sequelize.sync({ force: true });

  await Base.create({ nombre: 'Base Piedras', direccion: 'Av. Piedras 123', codigoAcceso: 'PIE2026', tipo: 'base' });
  await Base.create({ nombre: 'Base Once', direccion: 'Av. Rivadavia 456', codigoAcceso: 'ONC2026', tipo: 'base' });

  await Sector.create({ nombre: 'Operativo' });
  await Sector.create({ nombre: 'Administrativo' });
  await Sector.create({ nombre: 'Soporte Técnico', isAdmin: true, codigoAdmin: 'admin2024' });

  console.log('✅ Seed completado');
  await sequelize.close();
}

seed().catch((e) => {
  console.error('❌ Error en seed:', e);
  process.exit(1);
});
