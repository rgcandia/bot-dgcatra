import { User, Base, Sector, BaseSector } from '../models/models.js';
import { enviarTexto, enviarBotones } from './enviar.js';
import { config } from '../config/index.js';

type BotCtx = {
  telefono: string;
  texto: string;
  buttonId?: string;
};

async function cancelarRegistro(telefono: string): Promise<boolean> {
  await User.update(
    { pasoRegistro: 0, context: null, registroCompleto: false },
    { where: { telefono } }
  );
  return await enviarTexto(telefono, 'Registro cancelado. Cuando quieras intentarlo, escribí *hola* 👋');
}

async function paso0(ctx: BotCtx): Promise<boolean> {
  if (ctx.buttonId === 'reg_iniciar') {
    await User.upsert({ telefono: ctx.telefono, pasoRegistro: 1, context: null });
    return await enviarTexto(
      ctx.telefono,
      '🔑 Ingresá el *código de acceso* de tu base:\n\nEj: `ABC123`\n\n❌ O escribí *cancelar* para salir.'
    );
  }
  if (ctx.buttonId === 'reg_salir' || ctx.buttonId === 'cancelar') {
    return await enviarTexto(ctx.telefono, 'Ok. Cuando quieras registrarte, escribí *hola* 👋');
  }
  return await enviarBotones(
    ctx.telefono,
    '👮 *Bienvenido al sistema DGCatra*\n\nPara acceder necesitás registrarte.\n¿Querés comenzar?',
    [
      { id: 'reg_iniciar', title: '📝 Registrarme' },
      { id: 'reg_salir', title: '❌ Salir' },
    ]
  );
}

async function paso1CodigoBase(ctx: BotCtx): Promise<boolean> {
  if (ctx.texto?.toLowerCase() === 'cancelar') return await cancelarRegistro(ctx.telefono);
  if (!ctx.texto || ctx.texto.length < 3) {
    await enviarTexto(ctx.telefono, '❌ El código debe tener al menos 3 caracteres. Escribilo de nuevo:');
    return false;
  }

  const base = await Base.findOne({ where: { codigoAcceso: ctx.texto } });
  if (!base) {
    await enviarTexto(ctx.telefono, '❌ Código incorrecto. Intentá de nuevo:\n\n❌ O escribí *cancelar* para salir.');
    return false;
  }

  const user = await User.findByPk(ctx.telefono);
  if (!user) return false;

  const ctxData = (user.context || {}) as any;
  ctxData.baseId = base.id;
  ctxData.baseNombre = base.nombre;
  await user.update({ context: ctxData, pasoRegistro: 2 });

  const baseSectors = await BaseSector.findAll({ where: { baseId: base.id } });
  const sectorIds = baseSectors.map(bs => bs.sectorId);
  const sectores = await Sector.findAll({ where: { id: sectorIds }, order: [['nombre', 'ASC']] });

  if (sectores.length === 0) {
    await enviarTexto(ctx.telefono, '❌ No hay sectores en esta base. Contactá al administrador.');
    return false;
  }

  const buttons = [
    ...sectores.map(s => ({ id: `sector_${s.id}`, title: s.nombre })),
    { id: 'cancelar', title: '❌ Cancelar' },
  ];

  if (sectores.length <= 3) {
    return await enviarBotones(ctx.telefono, '👤 Seleccioná tu *sector*:', buttons);
  }
  const { enviarLista } = await import('./enviar.js');
  return await enviarLista(ctx.telefono, '👤 Seleccioná tu *sector*:', 'Ver sectores', buttons);
}

async function paso2Sector(ctx: BotCtx): Promise<boolean> {
  if (ctx.buttonId === 'cancelar') return await cancelarRegistro(ctx.telefono);
  const match = ctx.buttonId?.match(/^sector_(\d+)$/);
  if (!match) return false;
  const sectorId = parseInt(match[1]);
  const sector = await Sector.findByPk(sectorId);
  if (!sector) return false;
  const user = await User.findByPk(ctx.telefono);
  if (!user) return false;
  const ctxData = (user.context || {}) as any;
  ctxData.sectorId = sectorId;
  ctxData.sectorNombre = sector.nombre;
  await user.update({ context: ctxData, pasoRegistro: 3 });
  return await enviarTexto(ctx.telefono, '👤 Escribí tu *nombre completo*:\n\nEj: `Juan Pérez`\n\n❌ O escribí *cancelar* para salir.');
}

async function paso3Nombre(ctx: BotCtx): Promise<boolean> {
  if (ctx.texto?.toLowerCase() === 'cancelar') return await cancelarRegistro(ctx.telefono);
  if (!ctx.texto || ctx.texto.length < 3) {
    await enviarTexto(ctx.telefono, '❌ El nombre debe tener al menos 3 caracteres. Escribilo de nuevo:');
    return false;
  }
  const user = await User.findByPk(ctx.telefono);
  if (!user) return false;
  const ctxData = (user.context || {}) as any;
  ctxData.nombre = ctx.texto;
  await user.update({ context: ctxData, pasoRegistro: 4 });
  return await enviarBotones(
    ctx.telefono,
    '📧 ¿Querés registrar un *correo electrónico*?',
    [
      { id: 'email_si', title: '📧 Sí, escribir' },
      { id: 'email_no', title: '⏭️ Omitir' },
      { id: 'cancelar', title: '❌ Cancelar' },
    ]
  );
}

async function paso4Email(ctx: BotCtx): Promise<boolean> {
  if (ctx.buttonId === 'cancelar') return await cancelarRegistro(ctx.telefono);
  const user = await User.findByPk(ctx.telefono);
  if (!user) return false;
  const ctxData = (user.context || {}) as any;

  if (ctx.buttonId === 'email_si') {
    return await enviarTexto(ctx.telefono, 'Escribí tu *correo electrónico*:\n\n❌ O escribí *cancelar* para salir.');
  }
  if (ctx.buttonId === 'email_no') {
    ctxData.email = '';
    await user.update({ context: ctxData, pasoRegistro: 5 });
    return await mostrarConfirmacion(ctx.telefono, ctxData);
  }
  if (ctx.texto?.toLowerCase() === 'cancelar') return await cancelarRegistro(ctx.telefono);
  if (ctx.texto && ctx.texto.includes('@')) {
    ctxData.email = ctx.texto;
    await user.update({ context: ctxData, pasoRegistro: 5 });
    return await mostrarConfirmacion(ctx.telefono, ctxData);
  }
  await enviarTexto(ctx.telefono, '❌ Eso no parece un email válido. Escribí uno con @ (ej: nombre@correo.com):');
  return false;
}

async function mostrarConfirmacion(telefono: string, ctx: any): Promise<boolean> {
  const email = ctx.email ? `📧 ${ctx.email}` : '📧 No registrado';
  return await enviarBotones(
    telefono,
    '✅ *Confirmá tus datos:*\n\n' +
    `👤 *Nombre:* ${ctx.nombre}\n` +
    `🏢 *Base:* ${ctx.baseNombre}\n` +
    `⚙️ *Sector:* ${ctx.sectorNombre}\n` +
    `${email}\n\n` +
    '¿Está todo correcto?',
    [
      { id: 'conf_si', title: '✅ Confirmar' },
      { id: 'conf_no', title: '❌ Cancelar' },
    ]
  );
}

async function paso5Confirmar(ctx: BotCtx): Promise<boolean> {
  if (ctx.buttonId === 'conf_no' || ctx.buttonId === 'cancelar') {
    return await cancelarRegistro(ctx.telefono);
  }
  if (ctx.buttonId !== 'conf_si') return false;

  const user = await User.findByPk(ctx.telefono);
  if (!user) return false;
  const ctxData = (user.context || {}) as any;

  const esAdmin = config.superAdminPhone && ctx.telefono === config.superAdminPhone;

  await user.update({
    nombreCompleto: ctxData.nombre,
    email: ctxData.email || null,
    baseId: ctxData.baseId,
    sectorId: ctxData.sectorId,
    esAdmin,
    registroCompleto: true,
    pasoRegistro: 0,
    context: null,
  });

  return await enviarTexto(
    ctx.telefono,
    '✅ *¡Registro completo!*\n\n' +
    `Ya estás registrado en *${ctxData.baseNombre}* (${ctxData.sectorNombre}).\n\n` +
    'Ahora podés usar el bot. Escribí *ayuda* para ver los comandos disponibles.'
  );
}

export async function manejarRegistro(ctx: BotCtx): Promise<boolean> {
  const user = await User.findByPk(ctx.telefono);
  const paso = user?.pasoRegistro ?? 0;

  switch (paso) {
    case 0: return await paso0(ctx);
    case 1: return await paso1CodigoBase(ctx);
    case 2: return await paso2Sector(ctx);
    case 3: return await paso3Nombre(ctx);
    case 4: return await paso4Email(ctx);
    case 5: return await paso5Confirmar(ctx);
    default: return await paso0(ctx);
  }
}
