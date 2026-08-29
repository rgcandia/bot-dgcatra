import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Setting extends Model {
  declare clave: string;
  declare valor: string;
}

Setting.init({
  clave: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  valor: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'setting',
  tableName: 'settings',
  timestamps: false,
});
