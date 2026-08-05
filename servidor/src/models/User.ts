import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare telefono: string;
  declare chatId: string | null;
  declare nombreCompleto: string | null;
  declare email: string | null;
  declare baseId: number | null;
  declare sectorId: number | null;
  declare activo: CreationOptional<boolean>;
  declare esAdmin: CreationOptional<boolean>;
  declare registroCompleto: CreationOptional<boolean>;
  declare pasoRegistro: CreationOptional<number>;
  declare context: any | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

User.init({
  telefono: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  chatId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nombreCompleto: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  baseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  sectorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  esAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  registroCompleto: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  pasoRegistro: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  context: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, {
  sequelize,
  modelName: 'user',
  tableName: 'usuarios',
  timestamps: true,
});
