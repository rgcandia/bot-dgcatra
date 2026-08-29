import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Base, Sector, Conversacion } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';

async function notificarAgente(telefono: string, mensaje: string, ticketId?: number) {
  try {
    const { enviarTexto } = await import('../bot/enviar.js');
    await enviarTexto(telefono, mensaje, ticketId);
  } catch {}
}

export async function getAll(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (req.query.estado) where.estado = req.query.estado;
    if (req.query.prioridad) where.prioridad = req.query.prioridad;
    if (req.query.baseId) where.baseId = req.query.baseId;
    if (req.query.sectorId) where.sectorId = req.query.sectorId;
    if (req.query.tecnicoAsignado) where.tecnicoAsignado = req.query.tecnicoAsignado;
    if (req.query.sinAsignar === 'true') where.tecnicoAsignado = null;

    if (search) {
      where[Op.or] = [
        { asunto: { [Op.iLike]: `%${search}%` } },
        { descripcion: { [Op.iLike]: `%${search}%` } },
        { tecnicoAsignado: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = (req.query.sortDir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const SORT_MAP: Record<string, any[]> = {
      id: ['id'],
      asunto: ['asunto'],
      base: [{ model: Base, as: 'base' }, 'nombre'],
      estado: ['estado'],
      prioridad: ['prioridad'],
      tecnicoAsignado: ['tecnicoAsignado'],
      createdAt: ['createdAt'],
    };
    const orderCol = SORT_MAP[sortBy] || SORT_MAP.createdAt;
    const order = [[...orderCol, sortDir]] as any;

    const { count: total, rows: tickets } = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
        { model: Base, as: 'base', attributes: ['nombre'] },
        { model: Sector, as: 'sector', attributes: ['nombre'] },
      ],
      order,
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      data: tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll tickets');
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
        { model: Base, as: 'base', attributes: ['nombre'] },
        { model: Sector, as: 'sector', attributes: ['nombre'] },
      ],
    });
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });
    res.json(ticket);
  } catch (e) {
    logger.error({ err: e }, 'Error en getById ticket');
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { asunto, descripcion, ubicacion, baseId, sectorId } = req.body;
    if (!asunto || !descripcion || !ubicacion || !baseId) {
      return res.status(400).json({ error: 'asunto, descripcion, ubicacion y baseId son requeridos' });
    }

    const userTelefono = req.user?.telefono;
    if (!userTelefono) return res.status(401).json({ error: 'Usuario no autenticado' });

    const ticket = await Ticket.create({
      asunto, descripcion, ubicacion, baseId, sectorId: sectorId || null, userTelefono,
      estado: 'abierto', prioridad: 'media', historial: [],
    });

    const created = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
        { model: Base, as: 'base', attributes: ['nombre'] },
        { model: Sector, as: 'sector', attributes: ['nombre'] },
      ],
    });

    const io = getIO();
    if (io) io.emit('ticket-creado', created);

    res.status(201).json(created);
  } catch (e) {
    logger.error({ err: e }, 'Error en create ticket');
    res.status(500).json({ error: 'Error al crear ticket' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });

    const { estado, prioridad, tecnicoAsignado, solucion, nuevaNota } = req.body;
    const autor = req.user?.nombre || req.user?.telefono || 'Sistema';
    const isSuperAdmin = req.user?.superAdmin || false;
    const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];
    const oldEstado = ticket.estado;
    const oldTecnico = ticket.tecnicoAsignado;

    // Solo superAdmin puede cambiar prioridad y reasignar
    if (prioridad && prioridad !== ticket.prioridad) {
      if (!isSuperAdmin) return res.status(403).json({ error: 'Solo el administrador puede cambiar la prioridad' });
      historial.push({ accion: `${autor} cambió la prioridad a ${prioridad}`, autor, timestamp: new Date().toISOString() });
      ticket.prioridad = prioridad;
    }
    if (tecnicoAsignado !== undefined && tecnicoAsignado !== ticket.tecnicoAsignado) {
      const esAutoAsignacion = tecnicoAsignado === autor;
      const esDesasignarse = !tecnicoAsignado && autor === ticket.tecnicoAsignado;
      if (!isSuperAdmin && !esAutoAsignacion && !esDesasignarse) {
        return res.status(403).json({ error: 'Solo el administrador puede reasignar el técnico' });
      }
      historial.push({ accion: tecnicoAsignado ? `${autor} se asignó como técnico` : `${autor} se desvinculó del ticket`, autor, timestamp: new Date().toISOString() });
      ticket.tecnicoAsignado = tecnicoAsignado || null;
    }

    // Cambio de estado
    if (estado && estado !== ticket.estado) {
      const esDesasignarYReabrir = estado === 'abierto' && tecnicoAsignado !== undefined && !tecnicoAsignado;
      if (estado === 'abierto' && ticket.estado !== 'abierto' && !esDesasignarYReabrir) {
        if (!isSuperAdmin) return res.status(403).json({ error: 'Solo el administrador puede reabrir un ticket' });
      }
      const estadoLabel = estado === 'cerrado' ? 'cerró' : estado === 'en_proceso' ? 'puso en proceso' : 'reabrió';
      historial.push({ accion: `${autor} ${estadoLabel} el ticket`, autor, timestamp: new Date().toISOString() });
      ticket.estado = estado;
    }

    if (solucion !== undefined && solucion !== ticket.solucion) {
      historial.push({ accion: `${autor} registró la solución`, autor, timestamp: new Date().toISOString() });
      ticket.solucion = solucion || null;
    }

    if (nuevaNota && nuevaNota.trim() !== '') {
      const comentarios: any[] = Array.isArray(ticket.comentarios) ? ticket.comentarios : [];
      comentarios.push({ fecha: new Date().toLocaleString('es-AR'), autor, texto: nuevaNota.trim() });
      historial.push({ accion: `${autor} agregó un comentario`, autor, timestamp: new Date().toISOString() });
      ticket.comentarios = comentarios;
      ticket.changed('comentarios', true);

      if (ticket.userTelefono) {
        notificarAgente(
          ticket.userTelefono,
          `📋 *Ticket #${ticket.id}*: "${ticket.asunto}"\n💬 *${autor}* agregó un comentario:\n"${nuevaNota.trim()}"`,
          ticket.id,
        );
      }
    }

    ticket.historial = historial;
    ticket.changed('historial', true);
    await ticket.save();

    if (estado && estado !== oldEstado && ticket.userTelefono) {
      let msg = '';
      if (estado === 'en_proceso') {
        msg = `📋 *Ticket #${ticket.id}*: "${ticket.asunto}"\n` +
          `🔧 ${autor} ya está trabajando en tu caso.\n` +
          `Si ya se solucionó, escribí *cerrar ticket ${ticket.id}*.`;
      } else if (estado === 'cerrado') {
        msg = `📋 *Ticket #${ticket.id}*: "${ticket.asunto}"\n` +
          `✅ ${autor} lo marcó como *resuelto*.`;
        if (solucion) msg += `\n🔧 Solución: ${(solucion as string).substring(0, 200)}`;
      } else if (estado === 'abierto') {
        msg = `📋 *Ticket #${ticket.id}*: "${ticket.asunto}"\n` +
          `🔄 ${autor} reabrió el ticket.\n` +
          `Un técnico va a revisarlo nuevamente.`;
      }
      if (msg) notificarAgente(ticket.userTelefono, msg);
    }

    const updated = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
        { model: Base, as: 'base', attributes: ['nombre'] },
        { model: Sector, as: 'sector', attributes: ['nombre'] },
      ],
    });

    const io = getIO();
    if (io) {
      io.emit('ticket-actualizado', updated);
      if (tecnicoAsignado && tecnicoAsignado !== oldTecnico) {
        io.emit('ticket-asignado', { ...updated!.toJSON(), tecnicoAsignado });
      }
    }

    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, 'Error en update ticket');
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
}

export async function getConversacion(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) return res.status(400).json({ error: 'ID inválido' });

    const mensajes = await Conversacion.findAll({
      where: { ticketId },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'mensaje', 'direccion', 'createdAt'],
    });

    res.json(mensajes);
  } catch (e) {
    logger.error({ err: e }, 'Error en getConversacion');
    res.status(500).json({ error: 'Error al obtener conversación' });
  }
}
