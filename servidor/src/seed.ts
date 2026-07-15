import 'dotenv/config';
import { sequelize, Base, Sector, BaseSector } from './models/models.js';

async function seed() {
  await sequelize.sync({ force: true });

  const base1 = await Base.create({ nombre: 'Base Piedras', direccion: 'Av. Piedras 123', codigoAcceso: 'PIE2026' });
  const base2 = await Base.create({ nombre: 'Base Once', direccion: 'Av. Rivadavia 456', codigoAcceso: 'ONC2026' });

  const sector1 = await Sector.create({ nombre: 'Agente' });
  const sector2 = await Sector.create({ nombre: 'Supervisor' });
  const sector3 = await Sector.create({ nombre: 'Coordinador' });
  const sector4 = await Sector.create({ nombre: 'Soporte Técnico' });
  const sector5 = await Sector.create({ nombre: 'Mecánico' });
  const sector6 = await Sector.create({ nombre: 'Seguridad' });

  await BaseSector.create({ baseId: base1.id, sectorId: sector1.id });
  await BaseSector.create({ baseId: base1.id, sectorId: sector2.id });
  await BaseSector.create({ baseId: base1.id, sectorId: sector4.id });
  await BaseSector.create({ baseId: base2.id, sectorId: sector1.id });
  await BaseSector.create({ baseId: base2.id, sectorId: sector3.id });
  await BaseSector.create({ baseId: base2.id, sectorId: sector5.id });
  await BaseSector.create({ baseId: base2.id, sectorId: sector6.id });

  console.log('✅ Seed completado');
  await sequelize.close();
}

seed().catch((e) => {
  console.error('❌ Error en seed:', e);
  process.exit(1);
});
