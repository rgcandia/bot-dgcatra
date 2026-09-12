import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/auth.js';
import { User, Base } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';
import { normalizarTelefonoAR } from '../utils/telefono.js';

async function invalidarCacheUsuario(telefono: string) {
  try {
    const { invalidarCache } = await import('../bot/session.js');
    invalidarCache(telefono);
  } catch {}
}

export async function create(req: AuthRequest, res: Response) {
  try {
    // A2: Restringido a Super Admin
    if (!req.user?.superAdmin && req.user?.telefono !== process.env.SUPER_ADMIN_PHONE) {
      return res.status(403).json({ error: 'Solo el Super Administrador puede crear nuevos administradores' });
    }

    const { nombreCompleto, telefono, forzarPromocion } = req.body;
    if (!nombreCompleto || !telefono) {
      return res.status(400).json({ error: 'Nombre completo y teléfono son requeridos' });
    }

    const telNormalizado = normalizarTelefonoAR(telefono);
    if (!telNormalizado) {
      return res.status(400).json({ error: 'Formato de teléfono inválido para Argentina' });
    }

    // Buscar si ya existe
    const usuarioExistente = await User.findByPk(telNormalizado);
    
    // Si existe y NO se mandó el flag de confirmación de promoción
    if (usuarioExistente && !forzarPromocion) {
      return res.status(409).json({
        error: 'usuario_existente',
        message: `El número ${telNormalizado} ya se encuentra registrado en el sistema como "${usuarioExistente.nombreCompleto || 'Usuario anónimo'}" (con estado ${usuarioExistente.esAdmin ? 'Administrador' : 'Usuario regular'}). ¿Deseás promoverlo a administrador y enviarle la verificación de confirmación?`
      });
    }

    // Upsert o crear: registrado manualmente
    const [user, creada] = await User.findOrCreate({
      where: { telefono: telNormalizado },
      defaults: {
        telefono: telNormalizado,
        nombreCompleto,
        esAdmin: true,
        confirmadoWhatsApp: false,
        registroCompleto: true,
        activo: true,
        pasoRegistro: 0,
      }
    });

    if (!creada) {
      // Si ya existía y el super admin forzó la promoción, lo actualizamos
      await user.update({
        nombreCompleto,
        esAdmin: true,
        confirmadoWhatsApp: false,
        registroCompleto: true,
        activo: true,
        pasoRegistro: 0,
      });
    }

    // Enviar WhatsApp de confirmación
    try {
      const { enviarTexto } = await import('../bot/enviar.js');
      await enviarTexto(
        telNormalizado,
        `👋 Hola *${nombreCompleto}*. Te registraron como administrador en el sistema de tickets.\n\n` +
        `Respondé *confirmar* a este mensaje para activar tu cuenta y poder ingresar al panel.`
      );
    } catch (wsErr: any) {
      logger.error({ err: wsErr?.message }, 'Error al enviar WhatsApp de confirmación de admin');
      return res.status(503).json({ error: 'Admin registrado pero no se pudo enviar el WhatsApp de confirmación. Asegurate de que el bot esté conectado.' });
    }

    invalidarCacheUsuario(telNormalizado);
    const io = getIO();
    if (io) io.emit('datos-actualizados');

    res.status(201).json(user);
  } catch (e: any) {
    logger.error({ err: e?.message }, 'Error en create admin');
    res.status(500).json({ error: 'Error al registrar administrador' });
  }
}

export async function getAll(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (req.query.esAdmin === 'true') where.esAdmin = true;
    if (req.query.registroIncompleto === 'true') where.registroCompleto = false;
    
    // Filtrar por activos o inactivos según el query string
    if (req.query.inactivo === 'true') {
      where.activo = false;
    } else if (req.query.inactivo === 'false') {
      where.activo = true;
    }

    if (search) {
      where[Op.or] = [
        { nombreCompleto: { [Op.iLike]: `%${search}%` } },
        { telefono: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const sortBy = (req.query.sortBy as string) || 'nombreCompleto';
    const sortDir = (req.query.sortDir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const SORT_MAP: Record<string, any[]> = {
      telefono: ['telefono'],
      nombreCompleto: ['nombreCompleto'],
      base: [{ model: Base, as: 'base' }, 'nombre'],
      registroCompleto: ['registroCompleto'],
      esAdmin: ['esAdmin'],
    };
    const orderCol = SORT_MAP[sortBy] || SORT_MAP.nombreCompleto;
    const order = [[...orderCol, sortDir]] as any;

    const { count: total, rows: usuarios } = await User.findAndCountAll({
      where,
      include: [{ model: Base, as: 'base' }],
      order,
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      data: usuarios,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll usuarios');
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

export async function getByTelefono(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono, {
      include: [{ model: Base, as: 'base' }],
    });
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    res.json(user);
  } catch (e) {
    logger.error({ err: e }, 'Error en getByTelefono');
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono);
    if (!user) return res.status(404).json({ error: 'No encontrado' });

    const { nombreCompleto, email, baseId, activo } = req.body;
    const payload: Record<string, unknown> = { nombreCompleto, email, baseId, activo };

    if (req.body.esAdmin !== undefined) {
      if (!req.user?.esAdmin) {
        return res.status(403).json({ error: 'Solo un administrador puede cambiar permisos de admin' });
      }
      payload.esAdmin = req.body.esAdmin;
    }

    await user.update(payload);
    invalidarCacheUsuario(req.params.telefono);

    const io = getIO(); if (io) io.emit('datos-actualizados');

    const updated = await User.findByPk(req.params.telefono, {
      include: [{ model: Base, as: 'base' }],
    });
    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, 'Error en update usuario');
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono);
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    // Soft-delete: conserva tickets/historial y permite re-registrarse.
    await user.update({
      activo: false,
      registroCompleto: false,
      pasoRegistro: 0,
      context: null,
      esAdmin: false,
    });
    invalidarCacheUsuario(req.params.telefono);
    const io = getIO(); if (io) io.emit('datos-actualizados');
    res.json({ message: 'Usuario eliminado' });
  } catch (e) {
    logger.error({ err: e }, 'Error en remove usuario');
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}
