import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { sequelize } from '../config/database.js';

export async function resumen(_req: AuthRequest, res: Response) {
  try {
    const [data] = await sequelize.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'abierto')::int AS abiertos,
        COUNT(*) FILTER (WHERE estado = 'en_proceso')::int AS en_proceso,
        COUNT(*) FILTER (WHERE estado = 'cerrado')::int AS cerrados,
        COUNT(*) FILTER (WHERE prioridad = 'alta')::int AS alta_prioridad,
        (SELECT COUNT(*) FROM usuarios WHERE activo = true)::int AS usuarios_activos
      FROM tickets
    `);
    res.json(data[0]);
  } catch (e) {
    console.error('Error en stats resumen:', e);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function porBase(_req: AuthRequest, res: Response) {
  try {
    const data = await sequelize.query(`
      SELECT
        b.id, b.nombre,
        COUNT(t.id)::int AS total,
        COUNT(*) FILTER (WHERE t.estado = 'abierto')::int AS abiertos,
        COUNT(*) FILTER (WHERE t.estado = 'en_proceso')::int AS en_proceso,
        COUNT(*) FILTER (WHERE t.estado = 'cerrado')::int AS cerrados
      FROM bases b
      LEFT JOIN tickets t ON t."baseId" = b.id
      GROUP BY b.id, b.nombre
      ORDER BY total DESC
    `);
    res.json(data[0]);
  } catch (e) {
    console.error('Error en stats porBase:', e);
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
    console.error('Error en stats porMes:', e);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function topUsuarios(_req: AuthRequest, res: Response) {
  try {
    const data = await sequelize.query(`
      SELECT
        u.telefono, u."nombreCompleto",
        COUNT(t.id)::int AS total_tickets,
        COUNT(*) FILTER (WHERE t.estado = 'cerrado')::int AS resueltos
      FROM usuarios u
      LEFT JOIN tickets t ON t."userTelefono" = u.telefono
      GROUP BY u.telefono, u."nombreCompleto"
      ORDER BY total_tickets DESC
      LIMIT 20
    `);
    res.json(data[0]);
  } catch (e) {
    console.error('Error en stats topUsuarios:', e);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}
