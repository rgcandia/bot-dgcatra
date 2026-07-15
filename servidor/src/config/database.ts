import { Sequelize } from 'sequelize';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://norbridge:norbridge@db:5432/norbridge';

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});
