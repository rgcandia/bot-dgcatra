import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Ticket extends Model<InferAttributes<Ticket>, InferCreationAttributes<Ticket>> {
  declare id: CreationOptional<number>;
  declare asunto: string;
  declare descripcion: string;
  declare ubicacion: string;
  declare estado: CreationOptional<'abierto' | 'en_proceso' | 'cerrado'>;
  declare prioridad: CreationOptional<'baja' | 'media' | 'alta'>;
  declare baseId: number;
  declare sectorId: CreationOptional<number | null>;
  declare userTelefono: string;
  declare tecnicoAsignado: CreationOptional<string | null>;
  declare solucion: CreationOptional<string | null>;
  declare historial: CreationOptional<any[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Ticket.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  asunto: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  ubicacion: { type: DataTypes.STRING, allowNull: false },
  estado: { type: DataTypes.ENUM('abierto', 'en_proceso', 'cerrado'), defaultValue: 'abierto' },
  prioridad: { type: DataTypes.ENUM('baja', 'media', 'alta'), defaultValue: 'media' },
  baseId: { type: DataTypes.INTEGER, allowNull: false },
  sectorId: { type: DataTypes.INTEGER, allowNull: true },
  userTelefono: { type: DataTypes.STRING, allowNull: false },
  tecnicoAsignado: { type: DataTypes.STRING, allowNull: true },
  solucion: { type: DataTypes.TEXT, allowNull: true },
  historial: { type: DataTypes.JSON, defaultValue: [], allowNull: true },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, {
  sequelize,
  modelName: 'ticket',
  tableName: 'tickets',
  timestamps: true,
});
