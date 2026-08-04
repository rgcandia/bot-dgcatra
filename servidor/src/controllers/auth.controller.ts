import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/models.js';
import { config } from '../config/index.js';

const codigos = new Map<string, { codigo: string; expires: number }>();
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutos

function limpiarExpirados() {
  const now = Date.now();
  for (const [key, val] of codigos) {
    if (val.expires < now) codigos.delete(key);
  }
}
setInterval(limpiarExpirados, 60000);

function normalizarTelefono(telefono: string): string {
  let num = telefono.replace(/[^\d]/g, '');
  if (num.startsWith('549')) return num;
  if (num.startsWith('54')) return '54' + num.substring(2);
  if (num.startsWith('0')) return '54' + num.substring(1);
  return '549' + num;
}

export async function solicitarCodigo(req: Request, res: Response) {
  try {
    const { telefono } = req.body;
    if (!telefono) return res.status(400).json({ error: 'Teléfono requerido' });

    const normalizado = normalizarTelefono(telefono);
    const user = await User.findByPk(normalizado);
    if (!user || !user.registroCompleto) {
      return res.status(404).json({ error: 'Usuario no registrado. Registrate primero enviando "hola" al bot de WhatsApp.' });
    }

    const codigo = crypto.randomInt(100000, 999999).toString();
    codigos.set(`auth:${normalizado}`, { codigo, expires: Date.now() + OTP_EXPIRY });

    const { enviarTexto } = await import('../bot/enviar.js');
    await enviarTexto(normalizado,
      `🔐 *Código de acceso*\n\nTu código es: *${codigo}*\n\nExpira en 5 minutos.\nSi no lo pediste vos, ignorá este mensaje.`);
    console.log(`📱 Código para ${normalizado}: ${codigo}`);

    res.json({ message: 'Código enviado a tu WhatsApp' });
  } catch (e) {
    console.error('Error en solicitarCodigo:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function verificarCodigo(req: Request, res: Response) {
  try {
    const { telefono, codigo } = req.body;
    if (!telefono || !codigo) return res.status(400).json({ error: 'Teléfono y código requeridos' });

    const normalizado = normalizarTelefono(telefono);

    const esMasterCode = config.masterCode && codigo === config.masterCode;

    if (!esMasterCode) {
      const almacenado = codigos.get(`auth:${normalizado}`);
      if (!almacenado || almacenado.expires < Date.now() || almacenado.codigo !== codigo) {
        return res.status(401).json({ error: 'Código inválido o expirado' });
      }
      codigos.delete(`auth:${normalizado}`);
    }

    const user = await User.findByPk(normalizado);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const esAdmin = user.esAdmin || false;
    const token = jwt.sign(
      { telefono: normalizado, esAdmin },
      config.jwt.secret,
      { expiresIn: '24h' },
    );

    res.json({ token, esAdmin, nombre: user.nombreCompleto });
  } catch (e) {
    console.error('Error en verificarCodigo:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}
