import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Base, Conversacion } from '../models/models.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { logger } from '../config/logger.js';

export async function resumen(_req: AuthRequest, res: Response) {
  try {
    const [total, abiertos, enProceso, cerrados, altaPrioridad, usuariosActivos] = await Promise.all([
      Ticket.count(),
      Ticket.count({ where: { estado: 'abierto' } }),
      Ticket.count({ where: { estado: 'en_proceso' } }),
      Ticket.count({ where: { estado: 'cerrado' } }),
      Ticket.count({ where: { prioridad: 'alta' } }),
      User.count({ where: { activo: true } }),
    ]);

    res.json({ total, abiertos, en_proceso: enProceso, cerrados, alta_prioridad: altaPrioridad, usuarios_activos: usuariosActivos });
  } catch (e) {
    logger.error({ err: e }, 'Error en stats resumen');
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function porBase(_req: AuthRequest, res: Response) {
  try {
    const bases = await Base.findAll({
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']],
    });

    const data = await Promise.all(bases.map(async (b) => {
      const total = await Ticket.count({ where: { baseId: b.id } });
      const abiertos = await Ticket.count({ where: { baseId: b.id, estado: 'abierto' } });
      const enProceso = await Ticket.count({ where: { baseId: b.id, estado: 'en_proceso' } });
      const cerrados = await Ticket.count({ where: { baseId: b.id, estado: 'cerrado' } });

      return { id: b.id, nombre: b.nombre, total, abiertos, en_proceso: enProceso, cerrados };
    }));

    res.json(data.sort((a: any, b: any) => b.total - a.total));
  } catch (e) {
    logger.error({ err: e }, 'Error en stats porBase');
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function porMes(_req: AuthRequest, res: Response) {
  try {
    const data = await sequelize.query(`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') AS mes,
        COUNT(*)::int AS creados,
        COUNT(*) FILTER (WHERE estado = 'cerrado')::int AS cerrados
      FROM tickets
      GROUP BY mes
      ORDER BY mes DESC
      LIMIT 12
    `);
    res.json(data[0]);
  } catch (e) {
    logger.error({ err: e }, 'Error en stats porMes');
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function topUsuarios(_req: AuthRequest, res: Response) {
  try {
    const usuarios = await User.findAll({
      attributes: ['telefono', 'nombreCompleto'],
      include: [{
        model: Ticket,
        as: 'misTickets',
        attributes: ['id', 'estado'],
      }],
      limit: 40,
    });

    const data = usuarios
      .map(u => {
        const tickets = (u as any).misTickets || [];
        return {
          telefono: u.telefono,
          nombreCompleto: u.nombreCompleto,
          total_tickets: tickets.length,
          resueltos: tickets.filter((t: any) => t.estado === 'cerrado').length,
        };
      })
      .sort((a, b) => b.total_tickets - a.total_tickets)
      .slice(0, 20);

    res.json(data);
  } catch (e) {
    logger.error({ err: e }, 'Error en stats topUsuarios');
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function eliminarTickets(_req: AuthRequest, res: Response) {
  try {
    await Conversacion.destroy({ where: {} });
    await Ticket.destroy({ where: {} });
    res.json({ ok: true, mensaje: 'Todos los tickets eliminados' });
  } catch (e) {
    logger.error({ err: e }, 'Error en eliminarTickets');
    res.status(500).json({ error: 'Error al eliminar tickets' });
  }
}

export async function eliminarUsuarios(_req: AuthRequest, res: Response) {
  try {
    await User.destroy({ where: { esAdmin: false } });
    res.json({ ok: true, mensaje: 'Usuarios no-admin eliminados' });
  } catch (e) {
    logger.error({ err: e }, 'Error en eliminarUsuarios');
    res.status(500).json({ error: 'Error al eliminar usuarios' });
  }
}
