import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/auth.js';
import { sequelize, Sector } from '../models/models.js';
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
  const t = await sequelize.transaction();
  try {
    const { nombre, isAdmin, codigoAdmin } = req.body;
    if (!nombre) { await t.rollback(); return res.status(400).json({ error: 'Nombre requerido' }); }
    if (isAdmin && !codigoAdmin) { await t.rollback(); return res.status(400).json({ error: 'El código de admin es requerido para sectores admin' }); }
    if (isAdmin) await Sector.update({ isAdmin: false }, { where: { isAdmin: true }, transaction: t });
    const sector = await Sector.create({ nombre, isAdmin: !!isAdmin, codigoAdmin: codigoAdmin || null }, { transaction: t });
    await t.commit();
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.status(201).json(sector);
  } catch (e) {
    await t.rollback();
    console.error('Error en create sector:', e);
    res.status(500).json({ error: 'Error al crear sector' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  const t = await sequelize.transaction();
  try {
    const sector = await Sector.findByPk(req.params.id, { transaction: t });
    if (!sector) { await t.rollback(); return res.status(404).json({ error: 'No encontrado' }); }
    const { nombre, isAdmin, codigoAdmin } = req.body;
    if (isAdmin && !codigoAdmin && !sector.codigoAdmin) {
      await t.rollback();
      return res.status(400).json({ error: 'El código de admin es requerido para sectores admin' });
    }
    if (isAdmin) await Sector.update({ isAdmin: false }, { where: { isAdmin: true, id: { [Op.ne]: sector.id } }, transaction: t });
    await sector.update({ nombre, isAdmin, codigoAdmin: codigoAdmin ?? null }, { transaction: t });
    await t.commit();
    const reloaded = await Sector.findByPk(sector.id);
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json(reloaded);
  } catch (e) {
    await t.rollback();
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
