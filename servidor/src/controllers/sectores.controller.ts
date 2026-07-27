import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Sector, Base, BaseSector } from '../models/models.js';

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
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const sector = await Sector.create({ nombre });
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
    const { nombre } = req.body;
    await sector.update({ nombre });
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
    res.json({ message: 'Eliminado' });
  } catch (e) {
    console.error('Error en remove sector:', e);
    res.status(500).json({ error: 'Error al eliminar sector' });
  }
}

export async function getSectoresDeBase(req: AuthRequest, res: Response) {
  try {
    const baseId = req.params.baseId;
    const base = await Base.findByPk(baseId, {
      include: [{ model: Sector, as: 'sectores' }]
    });
    if (!base) return res.status(404).json({ error: 'Base no encontrada' });
    res.json((base as any).sectores);
  } catch (e) {
    console.error('Error en getSectoresDeBase:', e);
    res.status(500).json({ error: 'Error al obtener sectores' });
  }
}

export async function asignarSectorABase(req: AuthRequest, res: Response) {
  try {
    const { baseId, sectorId } = req.body;
    if (!baseId || !sectorId) return res.status(400).json({ error: 'baseId y sectorId requeridos' });
    await BaseSector.create({ baseId, sectorId });
    res.status(201).json({ message: 'Asignado' });
  } catch (e) {
    console.error('Error en asignarSectorABase:', e);
    res.status(500).json({ error: 'Error al asignar sector' });
  }
}

export async function removerSectorDeBase(req: AuthRequest, res: Response) {
  try {
    const { baseId, sectorId } = req.params;
    await BaseSector.destroy({ where: { baseId, sectorId } });
    res.json({ message: 'Removido' });
  } catch (e) {
    console.error('Error en removerSectorDeBase:', e);
    res.status(500).json({ error: 'Error al remover sector' });
  }
}
