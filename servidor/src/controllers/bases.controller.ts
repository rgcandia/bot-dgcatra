import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Base } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';

const TIPOS = ['base', 'playa', 'comuna'] as const;
type Tipo = (typeof TIPOS)[number];

function validarTipo(tipo: unknown): Tipo {
  return (TIPOS as readonly string[]).includes(tipo as string) ? (tipo as Tipo) : 'base';
}

export async function getAll(_req: AuthRequest, res: Response) {
  try {
    const bases = await Base.findAll({ order: [['nombre', 'ASC']] });
    res.json(bases);
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll bases');
    res.status(500).json({ error: 'Error al obtener bases' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const base = await Base.findByPk(req.params.id);
    if (!base) return res.status(404).json({ error: 'No encontrada' });
    res.json(base);
  } catch (e) {
    logger.error({ err: e }, 'Error en getById base');
    res.status(500).json({ error: 'Error al obtener base' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { nombre, direccion, codigoAcceso, tipo } = req.body;
    if (!nombre || !direccion || !codigoAcceso) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const base = await Base.create({ nombre, direccion, codigoAcceso, tipo: validarTipo(tipo) });
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.status(201).json(base);
  } catch (e) {
    logger.error({ err: e }, 'Error en create base');
    res.status(500).json({ error: 'Error al crear base' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const base = await Base.findByPk(req.params.id);
    if (!base) return res.status(404).json({ error: 'No encontrada' });
    const { nombre, direccion, codigoAcceso, tipo } = req.body;
    await base.update({
      nombre,
      direccion,
      codigoAcceso,
      tipo: tipo !== undefined ? validarTipo(tipo) : base.tipo,
    });
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json(base);
  } catch (e) {
    logger.error({ err: e }, 'Error en update base');
    res.status(500).json({ error: 'Error al actualizar base' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const base = await Base.findByPk(req.params.id);
    if (!base) return res.status(404).json({ error: 'No encontrada' });
    await base.destroy();
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json({ message: 'Eliminada' });
  } catch (e) {
    logger.error({ err: e }, 'Error en remove base');
    res.status(500).json({ error: 'Error al eliminar base' });
  }
}
