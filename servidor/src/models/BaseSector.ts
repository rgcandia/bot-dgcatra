import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes } from 'sequelize';

export class BaseSector extends Model<InferAttributes<BaseSector>, InferCreationAttributes<BaseSector>> {
  declare baseId: number;
  declare sectorId: number;
}

BaseSector.init({
  baseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  sectorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
}, {
  sequelize,
  modelName: 'base_sector',
  tableName: 'bases_sectores',
  timestamps: false,
});
