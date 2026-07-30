import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/models.js';
import { config } from '../config/index.js';

const codigos = new Map<string, { codigo: string; expires: number }>();

function limpiarExpirados() {
  const now = Date.now();
  for (const [key, val] of codigos) {
    if (val.expires < now) codigos.delete(key);
  }
}
setInterval(limpiarExpirados, 60000);

export async function solicitarCodigo(req: Request, res: Response) {
  try {
    const { telefono } = req.body;
    if (!telefono) return res.status(400).json({ error: 'Teléfono requerido' });

    const user = await User.findByPk(telefono);
    if (!user) return res.status(404).json({ error: 'Usuario no registrado' });

    const codigo = crypto.randomInt(100000, 999999).toString();
    codigos.set(`auth:${telefono}`, { codigo, expires: Date.now() + 300000 });

    console.log(`📱 Código para ${telefono}: ${codigo}`);

    res.json({ message: 'Código enviado' });
  } catch (e) {
    console.error('Error en solicitarCodigo:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function verificarCodigo(req: Request, res: Response) {
  try {
    const { telefono, codigo } = req.body;
    if (!telefono || !codigo) return res.status(400).json({ error: 'Teléfono y código requeridos' });

    const almacenado = codigos.get(`auth:${telefono}`);
    if (!almacenado || almacenado.expires < Date.now() || almacenado.codigo !== codigo) {
      return res.status(401).json({ error: 'Código inválido o expirado' });
    }

    codigos.delete(`auth:${telefono}`);

    const user = await User.findByPk(telefono);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const esAdmin = user.esAdmin || false;
    const token = jwt.sign({ telefono, esAdmin }, config.jwt.secret, { expiresIn: '8h' });

    res.json({ token, esAdmin });
  } catch (e) {
    console.error('Error en verificarCodigo:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}
