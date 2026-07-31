import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Base, Sector } from '../models/models.js';
import { getIO } from '../socket/server.js';

async function notificarAgente(telefono: string, mensaje: string) {
  try {
    const { enviarTexto } = await import('../bot/enviar.js');
    await enviarTexto(telefono, mensaje);
  } catch {}
}

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
    console.error('Error en create ticket:', e);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });

    const { estado, prioridad, tecnicoAsignado, solucion } = req.body;
    const autor = req.user?.telefono || 'Sistema';
    const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];
    const oldEstado = ticket.estado;

    if (estado && estado !== ticket.estado) {
      historial.push({ accion: `Estado: "${ticket.estado}" → "${estado}"`, autor, timestamp: new Date().toISOString() });
      ticket.estado = estado;
    }
    if (prioridad && prioridad !== ticket.prioridad) {
      historial.push({ accion: `Prioridad: "${ticket.prioridad}" → "${prioridad}"`, autor, timestamp: new Date().toISOString() });
      ticket.prioridad = prioridad;
    }
    if (tecnicoAsignado !== undefined && tecnicoAsignado !== ticket.tecnicoAsignado) {
      historial.push({ accion: `Técnico asignado: ${tecnicoAsignado}`, autor, timestamp: new Date().toISOString() });
      ticket.tecnicoAsignado = tecnicoAsignado || null;
    }
    if (solucion !== undefined && solucion !== ticket.solucion) {
      historial.push({ accion: `Solución registrada`, autor, timestamp: new Date().toISOString() });
      ticket.solucion = solucion || null;
    }

    ticket.historial = historial;
    await ticket.save();

    if (estado && estado !== oldEstado && ticket.userTelefono) {
      const labels: Record<string, string> = { en_proceso: 'en proceso ⚙️', cerrado: 'cerrado ✅', abierto: 'reabierto 🔴' };
      const label = labels[estado] || estado;
      let msg = `📋 *Ticket #${ticket.id}*\nTu ticket fue: *${label}*`;
      if (estado === 'cerrado' && solucion) msg += `\n\n🔧 Solución: ${(solucion as string).substring(0, 200)}`;
      if (estado === 'en_proceso') msg += '\n\nUn técnico ya está trabajando en tu caso.';
      notificarAgente(ticket.userTelefono, msg);
    }

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
