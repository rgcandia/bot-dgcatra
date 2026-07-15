import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Base } from '../models/models.js';

export async function getAll(_req: AuthRequest, res: Response) {
  try {
    const bases = await Base.findAll({ order: [['nombre', 'ASC']] });
    res.json(bases);
  } catch (e) {
    console.error('Error en getAll bases:', e);
    res.status(500).json({ error: 'Error al obtener bases' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const base = await Base.findByPk(req.params.id);
    if (!base) return res.status(404).json({ error: 'No encontrada' });
    res.json(base);
  } catch (e) {
    console.error('Error en getById base:', e);
    res.status(500).json({ error: 'Error al obtener base' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { nombre, direccion, codigoAcceso } = req.body;
    if (!nombre || !direccion || !codigoAcceso) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const base = await Base.create({ nombre, direccion, codigoAcceso });
    res.status(201).json(base);
  } catch (e) {
    console.error('Error en create base:', e);
    res.status(500).json({ error: 'Error al crear base' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const base = await Base.findByPk(req.params.id);
    if (!base) return res.status(404).json({ error: 'No encontrada' });
    const { nombre, direccion, codigoAcceso } = req.body;
    await base.update({ nombre, direccion, codigoAcceso });
    res.json(base);
  } catch (e) {
    console.error('Error en update base:', e);
    res.status(500).json({ error: 'Error al actualizar base' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const base = await Base.findByPk(req.params.id);
    if (!base) return res.status(404).json({ error: 'No encontrada' });
    await base.destroy();
    res.json({ message: 'Eliminada' });
  } catch (e) {
    console.error('Error en remove base:', e);
    res.status(500).json({ error: 'Error al eliminar base' });
  }
}
