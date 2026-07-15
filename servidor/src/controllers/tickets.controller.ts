import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Base, Sector } from '../models/models.js';
import { getIO } from '../socket/server.js';

export async function getAll(req: AuthRequest, res: Response) {
  try {
    const where: any = {};
    if (req.query.estado) where.estado = req.query.estado;
    if (req.query.prioridad) where.prioridad = req.query.prioridad;
    if (req.query.baseId) where.baseId = req.query.baseId;
    if (req.query.sectorId) where.sectorId = req.query.sectorId;

    const tickets = await Ticket.findAll({
      where,
      include: [
        { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
        { model: Base, as: 'base', attributes: ['nombre'] },
        { model: Sector, as: 'sector', attributes: ['nombre'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(tickets);
  } catch (e) {
    console.error('Error en getAll tickets:', e);
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
    console.error('Error en getById ticket:', e);
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });

    const { estado, prioridad, tecnicoAsignado, solucion } = req.body;
    const autor = req.user?.telefono || 'Sistema';
    const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];

    if (estado && estado !== ticket.estado) {
      historial.push({ accion: `Estado cambiado de "${ticket.estado}" a "${estado}"`, timestamp: new Date().toISOString() });
      ticket.estado = estado;
    }
    if (prioridad && prioridad !== ticket.prioridad) {
      historial.push({ accion: `Prioridad cambiada de "${ticket.prioridad}" a "${prioridad}"`, timestamp: new Date().toISOString() });
      ticket.prioridad = prioridad;
    }
    if (tecnicoAsignado !== undefined && tecnicoAsignado !== ticket.tecnicoAsignado) {
      historial.push({ accion: `Técnico asignado: ${tecnicoAsignado}`, timestamp: new Date().toISOString() });
      ticket.tecnicoAsignado = tecnicoAsignado || null;
    }
    if (solucion !== undefined && solucion !== ticket.solucion) {
      historial.push({ accion: `Solución registrada`, timestamp: new Date().toISOString() });
      ticket.solucion = solucion || null;
    }

    ticket.historial = historial;
    await ticket.save();

    const updated = await Ticket.findByPk(ticket.id, {
      include: [
        { model: User, as: 'usuario', attributes: ['nombreCompleto', 'telefono'] },
        { model: Base, as: 'base', attributes: ['nombre'] },
        { model: Sector, as: 'sector', attributes: ['nombre'] },
      ],
    });

    const io = getIO();
    if (io) io.emit('ticket-actualizado', updated);

    res.json(updated);
  } catch (e) {
    console.error('Error en update ticket:', e);
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
}
