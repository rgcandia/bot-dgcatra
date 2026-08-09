import { User, Base, Sector } from '../../models/models.js';
import { enviarTexto, enviarBotones, enviarLista } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';
import { config } from '../../config/index.js';
import { getIO } from '../../socket/server.js';
import type { BtnDef } from '../enviar.js';
import { esAfirmativo, esNegativo, esCancelar, normalizar } from '../helpers.js';

interface Ctx {
  telefono: string;
  texto: string;
  buttonId?: string;
}

export async function manejarRegistro(ctx: Ctx): Promise<boolean> {
  const user = await obtenerUsuario(ctx.telefono);
  const paso = user.pasoRegistro ?? 0;

  switch (paso) {
    case 0: return await paso0(ctx);
    case 1: return await paso1CodigoBase(ctx);
    case 2: return await paso2Sector(ctx);
    case 3: return await paso3CodigoAdmin(ctx);
    case 4: return await paso4Nombre(ctx);
    case 6: return await paso6Confirmar(ctx);
    default: return await paso0(ctx);
  }
}

async function cancelarRegistro(telefono: string, paso: number) {
  await guardarUsuario(telefono, {
    pasoRegistro: 0,
    context: null,
    registroCompleto: false,
  });

  const mensajes: Record<number, string> = {
    1: 'Registro cancelado. Si conseguís el código de tu base, escribí *hola*.',
    4: 'Registro cancelado. Ya casi estabas! Escribí *hola* para retomar.',
  };
  const msg = mensajes[paso] || 'Registro cancelado. Cuando quieras intentarlo, escribí *hola*.';
  return await enviarTexto(telefono, msg);
}

async function paso0(ctx: Ctx): Promise<boolean> {
  const textoLower = (ctx.texto || '').toLowerCase().trim();
  if (ctx.buttonId === 'cancelar') {
    return await enviarTexto(ctx.telefono, 'Ok. Cuando quieras registrarte, escribí *hola*.');
  }
  if (esAfirmativo(textoLower)) {
    await guardarUsuario(ctx.telefono, { pasoRegistro: 1, context: null });
    return await enviarTexto(ctx.telefono,
      '🔑 Ingresá el *código de acceso* de tu base:\n\nEj: `ABC123`\n\nEscribí *cancelar* para salir.');
  }
  if (esNegativo(textoLower)) {
    return await enviarTexto(ctx.telefono, 'Ok. Cuando quieras registrarte, escribí *hola*.');
  }
  return await enviarTexto(ctx.telefono,
    '🤖 *¡Bienvenido! Sistema de Gestión de Tickets DGCATRA*\n\nPara registrarte escribí *SI*.\nPara cancelar escribí *NO*.');
}

async function paso1CodigoBase(ctx: Ctx): Promise<boolean> {
  if (esCancelar(ctx.texto || '')) return await cancelarRegistro(ctx.telefono, 1);

  if (!ctx.texto || ctx.texto.length < 3) {
    await enviarTexto(ctx.telefono, '❌ El código debe tener al menos 3 caracteres. Intentá de nuevo:');
    return false;
  }

  const base = await Base.findOne({ where: { codigoAcceso: ctx.texto } });
  if (!base) {
    await enviarTexto(ctx.telefono, '❌ Código incorrecto. Intentá de nuevo o escribí *cancelar* para salir.');
    return false;
  }

  const sectores = await Sector.findAll({ order: [['nombre', 'ASC']] });

  if (sectores.length === 0) {
    await enviarTexto(ctx.telefono, '❌ No hay sectores disponibles. Contactá al administrador.');
    return false;
  }

  await guardarUsuario(ctx.telefono, {
    pasoRegistro: 2,
    context: { baseId: base.id, baseNombre: base.nombre },
  });

  if (sectores.length <= 3) {
    const btns: BtnDef[] = [
      ...sectores.map(s => ({ id: `sector_${s.id}`, title: s.nombre })),
      { id: 'cancelar', title: 'Cancelar' },
    ];
    return await enviarBotones(ctx.telefono, '👤 Seleccioná tu *sector*:\n\nEscribí el número de la opción.', btns);
  }

  return await enviarLista(
    ctx.telefono,
    '👤 Seleccioná tu *sector*:\n\nEscribí el número de la opción.',
    'Ver sectores',
    [{
      title: 'Sectores',
      rows: [
        ...sectores.map(s => ({ id: `sector_${s.id}`, title: s.nombre })),
        { id: 'cancelar', title: '❌ Cancelar' },
      ],
    }],
  );
}

async function paso2Sector(ctx: Ctx): Promise<boolean> {
  const textoLower = (ctx.texto || '').toLowerCase().trim();
  if (ctx.buttonId === 'cancelar' || esCancelar(textoLower)) return await cancelarRegistro(ctx.telefono, 2);

  const match = ctx.buttonId?.match(/^sector_(\d+)$/);
  if (!match) {
    return await paso2SectorTexto(ctx);
  }

  const sectorId = parseInt(match[1]);
  const sector = await Sector.findByPk(sectorId);
  if (!sector) return false;

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  ctxData.sectorId = sectorId;
  ctxData.sectorNombre = sector.nombre;
  ctxData.codigoAdmin = sector.codigoAdmin;
  ctxData.sectorIsAdmin = sector.isAdmin;

  if (sector.codigoAdmin) {
    await guardarUsuario(ctx.telefono, { pasoRegistro: 3, context: ctxData });
    return await enviarTexto(ctx.telefono,
      '🔐 *Autorización de administrador*\n\nIngresá el *código de acceso*:\n\nEscribí *cancelar* para volver atrás.');
  }

  await guardarUsuario(ctx.telefono, { pasoRegistro: 4, context: ctxData });
  return await enviarTexto(ctx.telefono,
    '👤 Escribí tu *nombre completo*:\n\nEj: `Juan Pérez`\n\nEscribí *cancelar* para salir.');
}

async function paso2SectorTexto(ctx: Ctx): Promise<boolean> {
  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  const lastButtons: BtnDef[] | undefined = ctxData._lastButtons;

  const texto = (ctx.texto || '').trim();
  const textoNorm = normalizar(texto);
  let sectorId: number | null = null;
  let sectorNombre: string | null = null;

  const num = parseInt(texto);
  if (!isNaN(num) && num >= 1 && lastButtons && num <= lastButtons.length) {
    const btn = lastButtons[num - 1];
    if (btn.id === 'cancelar') {
      await enviarTexto(ctx.telefono, `❌ Opción inválida. Elegí un número del 1 al ${lastButtons.length}.`);
      return false;
    }
    const matchBtn = (btn.id as string).match(/^sector_(\d+)$/);
    if (matchBtn) {
      sectorId = parseInt(matchBtn[1]);
    }
  } else {
    const sectores = await Sector.findAll({ order: [['nombre', 'ASC']] });
    let filtered = sectores.filter(s => normalizar(s.nombre) === textoNorm);
    if (filtered.length === 0) {
      filtered = sectores.filter(s => normalizar(s.nombre).includes(textoNorm));
    }
    if (filtered.length === 0) {
      filtered = sectores.filter(s => normalizar(s.nombre).includes(textoNorm.split(' ')[0]));
    }
    if (filtered.length === 0) {
      await enviarTexto(ctx.telefono,
        '❌ Sector no encontrado.\nEscribí el *número* o el *nombre* del sector.');
      return false;
    }
    if (filtered.length > 1) {
      const nombres = filtered.map(s => s.nombre).join(', ');
      await enviarTexto(ctx.telefono,
        `❓ Varios sectores coinciden: *${nombres}*\n\nEscribí el nombre exacto o el número de la opción.`);
      return false;
    }
    sectorId = filtered[0].id;
    sectorNombre = filtered[0].nombre;
  }

  if (!sectorId) {
    await enviarTexto(ctx.telefono, '❌ Opción inválida. Escribí el número o el nombre del sector.');
    return false;
  }

  const sector = await Sector.findByPk(sectorId);
  if (!sector) return false;

  ctxData.sectorId = sector.id;
  ctxData.sectorNombre = sector.nombre;
  ctxData.codigoAdmin = sector.codigoAdmin;
  ctxData.sectorIsAdmin = sector.isAdmin;

  if (sector.codigoAdmin) {
    await guardarUsuario(ctx.telefono, { pasoRegistro: 3, context: ctxData });
    return await enviarTexto(ctx.telefono,
      '🔐 *Autorización de administrador*\n\nIngresá el *código de acceso*:\n\nEscribí *cancelar* para volver atrás.');
  }

  await guardarUsuario(ctx.telefono, { pasoRegistro: 4, context: ctxData });
  return await enviarTexto(ctx.telefono,
    '👤 Escribí tu *nombre completo*:\n\nEj: `Juan Pérez`\n\nEscribí *cancelar* para salir.');
}

async function paso3CodigoAdmin(ctx: Ctx): Promise<boolean> {
  if (esCancelar(ctx.texto || '')) {
    const user = await obtenerUsuario(ctx.telefono);
    const ctxData = (user.context || {}) as any;
    delete ctxData.sectorId;
    delete ctxData.sectorNombre;
    delete ctxData.codigoAdmin;
    await guardarUsuario(ctx.telefono, { pasoRegistro: 2, context: ctxData });
    return await enviarTexto(ctx.telefono, 'Volvé a seleccionar tu sector:');
  }

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  const codigoAdmin = ctxData.codigoAdmin;

  if (ctx.texto?.trim() !== codigoAdmin) {
    await enviarTexto(ctx.telefono, '❌ Código incorrecto. Intentá de nuevo o escribí *cancelar*.');
    return false;
  }

  await guardarUsuario(ctx.telefono, { pasoRegistro: 4, context: ctxData });
  return await enviarTexto(ctx.telefono,
    '👤 Escribí tu *nombre completo*:\n\nEj: `Juan Pérez`\n\nEscribí *cancelar* para salir.');
}

async function paso4Nombre(ctx: Ctx): Promise<boolean> {
  if (esCancelar(ctx.texto || '')) return await cancelarRegistro(ctx.telefono, 4);

  if (!ctx.texto || ctx.texto.length < 3) {
    await enviarTexto(ctx.telefono, '❌ El nombre debe tener al menos 3 caracteres. Escribilo de nuevo:');
    return false;
  }

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  ctxData.nombre = ctx.texto;

  await guardarUsuario(ctx.telefono, { pasoRegistro: 6, context: ctxData });

  return await mostrarConfirmacion(ctx.telefono, ctxData);
}

async function mostrarConfirmacion(telefono: string, ctx: any): Promise<boolean> {
  const rol = ctx.sectorIsAdmin ? '🛡️ Admin' : '';
  const rolLine = rol ? `${rol}\n` : '';
  return await enviarTexto(telefono,
    '✅ *Confirmá tus datos:*\n\n' +
    `👤 *Nombre:* ${ctx.nombre}\n` +
    `🏢 *Base:* ${ctx.baseNombre}\n` +
    `⚙️ *Sector:* ${ctx.sectorNombre}\n` +
    `${rolLine}` +
    '¿Querés confirmar el registro?\nEscribí *SI* o *NO*.');
}

async function paso6Confirmar(ctx: Ctx): Promise<boolean> {
  const textoLower = (ctx.texto || '').toLowerCase().trim();
  if (ctx.buttonId === 'cancelar' || esNegativo(textoLower)) return await cancelarRegistro(ctx.telefono, 6);
  if (!esAfirmativo(textoLower)) return false;

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;

  const esAdmin = ctxData.sectorIsAdmin || (config.superAdminPhone && ctx.telefono === config.superAdminPhone);

  await guardarUsuario(ctx.telefono, {
    nombreCompleto: ctxData.nombre,
    email: ctxData.email ? String(ctxData.email) : null,
    baseId: ctxData.baseId,
    sectorId: ctxData.sectorId,
    esAdmin: !!esAdmin,
    registroCompleto: true,
    pasoRegistro: 0,
    context: null,
  });

  const io = getIO();
  if (io) io.emit('usuario-registrado');

  return await enviarTexto(ctx.telefono,
    '✅ *¡Registro completo!*\n\n' +
    `Ya estás registrado en *${ctxData.baseNombre}* (${ctxData.sectorNombre}).\n\n` +
    'Escribí *ayuda* para ver los comandos disponibles.');
}
