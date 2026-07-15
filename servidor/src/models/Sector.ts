import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Sector extends Model<InferAttributes<Sector>, InferCreationAttributes<Sector>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
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
}, {
  sequelize,
  modelName: 'sector',
  tableName: 'sectores',
  timestamps: false,
});
