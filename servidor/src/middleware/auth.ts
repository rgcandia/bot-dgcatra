import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/models.js';
import { logger } from '../config/logger.js';

export interface AuthRequest extends Request {
  user?: { telefono: string; esAdmin: boolean; superAdmin?: boolean; nombre?: string };
}

export async function usuarioActivo(telefono: string): Promise<boolean> {
  const user = await User.findByPk(telefono);
  return !!user && user.activo === true;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  let decoded: { telefono: string; esAdmin: boolean; superAdmin?: boolean; nombre?: string };
  try {
    decoded = jwt.verify(header.split(' ')[1], config.jwt.secret) as typeof decoded;
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // El código maestro (superAdmin) no corresponde a un usuario real; bypass del chequeo de activo.
  if (!decoded.superAdmin) {
    try {
      const activo = await usuarioActivo(decoded.telefono);
      if (!activo) {
        return res.status(401).json({ error: 'Usuario desactivado. Contactá al administrador.' });
      }
    } catch (err) {
      logger.error({ err }, 'Error validando usuario en authMiddleware');
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  req.user = { telefono: decoded.telefono, esAdmin: decoded.esAdmin, superAdmin: decoded.superAdmin, nombre: decoded.nombre };
  next();
}
