import { sequelize } from '../config/database.js';
import { Base } from './Base.js';
import { User } from './User.js';
import { Ticket } from './Ticket.js';
import { Conversacion } from './Conversacion.js';
import { Setting } from './Setting.js';

User.belongsTo(Base, { foreignKey: 'baseId', as: 'base' });
Base.hasMany(User, { foreignKey: 'baseId', as: 'usuarios' });

User.hasMany(Ticket, { foreignKey: 'userTelefono', as: 'misTickets' });
Ticket.belongsTo(User, { foreignKey: 'userTelefono', as: 'usuario' });
Ticket.belongsTo(Base, { foreignKey: 'baseId', as: 'base' });
Base.hasMany(Ticket, { foreignKey: 'baseId', as: 'tickets' });

User.hasMany(Conversacion, { foreignKey: 'userTelefono', as: 'conversaciones' });
Conversacion.belongsTo(User, { foreignKey: 'userTelefono', as: 'usuario' });
Ticket.hasMany(Conversacion, { foreignKey: 'ticketId', as: 'mensajes' });
Conversacion.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

export {
  sequelize,
  Base,
  User,
  Ticket,
  Conversacion,
  Setting,
};
