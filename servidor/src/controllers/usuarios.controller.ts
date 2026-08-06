import { Response } from 'express';
import { AuthRequest, banearUsuario } from '../middleware/auth.js';
import { User, Base, Sector } from '../models/models.js';
import { getIO } from '../socket/server.js';

export async function getAll(_req: AuthRequest, res: Response) {
  try {
    const usuarios = await User.findAll({
      include: [
        { model: Base, as: 'base' },
        { model: Sector, as: 'sector' },
      ],
      order: [['nombreCompleto', 'ASC']],
    });
    res.json(usuarios);
  } catch (e) {
    console.error('Error en getAll usuarios:', e);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

export async function getByTelefono(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono, {
      include: [
        { model: Base, as: 'base' },
        { model: Sector, as: 'sector' },
      ],
    });
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    res.json(user);
  } catch (e) {
    console.error('Error en getByTelefono:', e);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono);
    if (!user) return res.status(404).json({ error: 'No encontrado' });

    const { nombreCompleto, email, baseId, sectorId, activo } = req.body;
    const payload: Record<string, unknown> = { nombreCompleto, email, baseId, sectorId, activo };

    if (req.body.esAdmin !== undefined) {
      if (!req.user?.esAdmin) {
        return res.status(403).json({ error: 'Solo un administrador puede cambiar permisos de admin' });
      }
      payload.esAdmin = req.body.esAdmin;
    }

    await user.update(payload);

    const io = getIO(); if (io) io.emit('datos-actualizados');

    const updated = await User.findByPk(req.params.telefono, {
      include: [
        { model: Base, as: 'base' },
        { model: Sector, as: 'sector' },
      ],
    });
    res.json(updated);
  } catch (e) {
    console.error('Error en update usuario:', e);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono);
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    const telefono = user.telefono;
    await user.destroy();
    banearUsuario(telefono);
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json({ message: 'Usuario eliminado' });
  } catch (e) {
    console.error('Error en remove usuario:', e);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}
