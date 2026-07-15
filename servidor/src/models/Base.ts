import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Base extends Model<InferAttributes<Base>, InferCreationAttributes<Base>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare direccion: string;
  declare codigoAcceso: string;
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
    unique: true,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  codigoAcceso: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'base',
  tableName: 'bases',
  timestamps: false,
});
