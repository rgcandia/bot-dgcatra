import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Sector } from '../models/models.js';
import { getIO } from '../socket/server.js';

export async function getAll(_req: AuthRequest, res: Response) {
  try {
    const sectores = await Sector.findAll({ order: [['nombre', 'ASC']] });
    res.json(sectores);
  } catch (e) {
    console.error('Error en getAll sectores:', e);
    res.status(500).json({ error: 'Error al obtener sectores' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const sector = await Sector.findByPk(req.params.id);
    if (!sector) return res.status(404).json({ error: 'No encontrado' });
    res.json(sector);
  } catch (e) {
    console.error('Error en getById sector:', e);
    res.status(500).json({ error: 'Error al obtener sector' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { nombre, isAdmin, codigoAdmin } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (isAdmin && !codigoAdmin) return res.status(400).json({ error: 'El código de admin es requerido para sectores admin' });
    const sector = await Sector.create({ nombre, isAdmin: !!isAdmin, codigoAdmin: codigoAdmin || null });
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.status(201).json(sector);
  } catch (e) {
    console.error('Error en create sector:', e);
    res.status(500).json({ error: 'Error al crear sector' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const sector = await Sector.findByPk(req.params.id);
    if (!sector) return res.status(404).json({ error: 'No encontrado' });
    const { nombre, isAdmin, codigoAdmin } = req.body;
    const updates: Record<string, unknown> = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (isAdmin !== undefined) {
      updates.isAdmin = isAdmin;
      if (isAdmin && !codigoAdmin && !sector.codigoAdmin) {
        return res.status(400).json({ error: 'El código de admin es requerido para sectores admin' });
      }
    }
    if (codigoAdmin !== undefined) updates.codigoAdmin = codigoAdmin || null;
    await sector.update(updates);
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json(sector);
  } catch (e) {
    console.error('Error en update sector:', e);
    res.status(500).json({ error: 'Error al actualizar sector' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const sector = await Sector.findByPk(req.params.id);
    if (!sector) return res.status(404).json({ error: 'No encontrado' });
    await sector.destroy();
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json({ message: 'Eliminado' });
  } catch (e) {
    console.error('Error en remove sector:', e);
    res.status(500).json({ error: 'Error al eliminar sector' });
  }
}
