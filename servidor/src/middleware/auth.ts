import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthRequest extends Request {
  user?: { telefono: string; esAdmin: boolean; superAdmin?: boolean; nombre?: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as { telefono: string; esAdmin: boolean; superAdmin?: boolean; nombre?: string };
    req.user = { telefono: decoded.telefono, esAdmin: decoded.esAdmin, superAdmin: decoded.superAdmin, nombre: decoded.nombre };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
