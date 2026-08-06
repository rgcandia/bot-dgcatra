import { sequelize } from './models/models.js';

async function reset() {
  console.log('⏳ Eliminando y recreando todas las tablas...');
  await sequelize.sync({ force: true });
  console.log('✅ Todas las tablas recreadas desde cero. IDs reiniciados.');
  await sequelize.close();
}

reset().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
