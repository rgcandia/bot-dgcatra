import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Conversacion } from '../models/models.js';
import { getIO } from '../socket/server.js';

async function invalidarCacheUsuario(telefono: string) {
  try {
    const { invalidarCache } = await import('../bot/session.js');
    invalidarCache(telefono);
  } catch {}
}

async function enviarPorWhatsApp(telefono: string, texto: string, ticketId: number) {
  try {
    const { enviarTexto } = await import('../bot/enviar.js');
    await enviarTexto(telefono, texto, ticketId);
  } catch {}
}

export async function iniciarChat(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const adminNombre = req.user?.nombre || 'Técnico';
    const user = await User.findByPk(ticket.userTelefono);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.context = {
      ...(user.context || {}),
      chatConAdmin: {
        adminId: req.user?.telefono || 'admin',
        adminNombre,
        startedAt: Date.now(),
        lastActivity: Date.now(),
      },
    };
    user.changed('context', true);
    await user.save();

    invalidarCacheUsuario(ticket.userTelefono);

    // Timeout: si no hay actividad del admin en 5 min, devolver al bot
    const CHAT_TIMEOUT = 5 * 60 * 1000;
    setTimeout(async () => {
      try {
        const u = await User.findByPk(ticket.userTelefono);
        if (!u) return;
        const chat = (u.context as any)?.chatConAdmin;
        if (chat && chat.adminId && Date.now() - chat.lastActivity > CHAT_TIMEOUT) {
          u.context = { ...(u.context || {}), chatConAdmin: null };
          u.changed('context', true);
          await u.save();

          const { enviarTexto } = await import('../bot/enviar.js');
          await enviarTexto(ticket.userTelefono,
            `📢 *Ticket #${ticket.id}*\n\nEl técnico finalizó la charla por inactividad. Si necesitás algo más, escribí *ayuda*.`,
            ticket.id);

          const io = getIO();
          if (io) io.emit('chat-estado', { ticketId: ticket.id, estado: 'inactivo', admin: null });
        }
      } catch {}
    }, CHAT_TIMEOUT + 5000);

    enviarPorWhatsApp(
      ticket.userTelefono,
      `📢 *Ticket #${ticket.id}*\n\nUn técnico se pondrá en contacto con vos a la brevedad.`,
      ticket.id,
    );

    const io = getIO();
    if (io) io.emit('chat-estado', { ticketId, estado: 'activo', admin: adminNombre });

    res.json({ ok: true, estado: 'activo' });
  } catch (e) {
    console.error('Error en iniciarChat:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function enviarMensaje(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const adminNombre = req.user?.nombre || 'Técnico';
    const texto = `💬 *Técnico ${adminNombre}:* ${mensaje}`;

    const user = await User.findByPk(ticket.userTelefono);
    if (user) {
      const chat = (user.context as any)?.chatConAdmin;
      if (chat) {
        chat.lastActivity = Date.now();
        user.context = { ...(user.context || {}), chatConAdmin: chat };
        user.changed('context', true);
        await user.save();
      }
    }

    await enviarPorWhatsApp(ticket.userTelefono, texto, ticket.id);

    res.json({ ok: true, mensaje, autor: adminNombre, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Error en enviarMensaje:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function finalizarChat(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const user = await User.findByPk(ticket.userTelefono);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.context = {
      ...(user.context || {}),
      chatConAdmin: null,
    };
    user.changed('context', true);
    await user.save();

    invalidarCacheUsuario(ticket.userTelefono);

    // Avisar al usuario
    enviarPorWhatsApp(
      ticket.userTelefono,
      `📢 *Ticket #${ticket.id}*\n\nEl técnico finalizó la charla. Si necesitás algo más, escribí *ayuda*.`,
      ticket.id,
    );

    const io = getIO();
    if (io) io.emit('chat-estado', { ticketId, estado: 'inactivo', admin: null });

    res.json({ ok: true, estado: 'inactivo' });
  } catch (e) {
    console.error('Error en finalizarChat:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function estadoChat(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const user = await User.findByPk(ticket.userTelefono);
    const chatData = (user?.context as any)?.chatConAdmin;

    if (chatData && chatData.adminId) {
      res.json({ activo: true, admin: chatData.adminNombre, startedAt: chatData.startedAt });
    } else {
      res.json({ activo: false, admin: null });
    }
  } catch (e) {
    console.error('Error en estadoChat:', e);
    res.status(500).json({ error: 'Error interno' });
  }
}
