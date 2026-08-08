import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Sector extends Model<InferAttributes<Sector>, InferCreationAttributes<Sector>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare isAdmin: CreationOptional<boolean>;
  declare codigoAdmin: CreationOptional<string | null>;
}

Sector.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  codigoAdmin: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
}, {
  sequelize,
  modelName: 'sector',
  tableName: 'sectores',
  timestamps: false,
});
