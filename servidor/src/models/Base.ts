import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Base extends Model<InferAttributes<Base>, InferCreationAttributes<Base>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare direccion: string;
  declare tipo: CreationOptional<'base' | 'playa' | 'comuna'>;
}

Base.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.ENUM('base', 'playa', 'comuna'),
    allowNull: false,
    defaultValue: 'base',
  },
}, {
  sequelize,
  modelName: 'base',
  tableName: 'bases',
  timestamps: false,
  // Nombre fijo: evita que sync({alter:true}) recree índices UNIQUE duplicados en cada arranque.
  indexes: [{ name: 'bases_nombre_unique', unique: true, fields: ['nombre'] }],
});
