import { User, Base, Sector, BaseSector } from '../../models/models.js';
import { enviarTexto, enviarBotones, enviarLista } from '../enviar.js';
import { obtenerUsuario, guardarUsuario } from '../session.js';
import { config } from '../../config/index.js';
import { getSetting } from '../../config/settings.js';
import type { BtnDef } from '../enviar.js';

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
    case 3: return await paso3Nombre(ctx);
    case 4: return await paso4Email(ctx);
    case 5: return await paso5Rol(ctx);
    case 6: return await paso6CodigoAdmin(ctx);
    case 7: return await paso7Confirmar(ctx);
    default: return await paso0(ctx);
  }
}

async function cancelarRegistro(telefono: string) {
  await guardarUsuario(telefono, {
    pasoRegistro: 0,
    context: null,
    registroCompleto: false,
  });
  return await enviarTexto(telefono, 'Registro cancelado. Cuando quieras intentarlo, escribí *hola*.');
}

async function paso0(ctx: Ctx): Promise<boolean> {
  if (ctx.buttonId === 'reg_iniciar') {
    await guardarUsuario(ctx.telefono, { pasoRegistro: 1, context: null });
    return await enviarTexto(ctx.telefono,
      '🔑 Ingresá el *código de acceso* de tu base:\n\nEj: `ABC123`\n\nEscribí *cancelar* para salir.');
  }
  if (ctx.buttonId === 'reg_salir' || ctx.buttonId === 'cancelar') {
    return await enviarTexto(ctx.telefono, 'Ok. Cuando quieras registrarte, escribí *hola*.');
  }
  return await enviarBotones(ctx.telefono,
    '👮 *Bienvenido al sistema DGCatra*\n\nPara acceder necesitás registrarte.\n¿Querés comenzar?',
    [
      { id: 'reg_iniciar', title: 'Registrarme' },
      { id: 'reg_salir', title: 'Salir' },
    ]);
}

async function paso1CodigoBase(ctx: Ctx): Promise<boolean> {
  if (ctx.texto?.toLowerCase() === 'cancelar') return await cancelarRegistro(ctx.telefono);

  if (!ctx.texto || ctx.texto.length < 3) {
    await enviarTexto(ctx.telefono, '❌ El código debe tener al menos 3 caracteres. Intentá de nuevo:');
    return false;
  }

  const base = await Base.findOne({ where: { codigoAcceso: ctx.texto } });
  if (!base) {
    await enviarTexto(ctx.telefono, '❌ Código incorrecto. Intentá de nuevo o escribí *cancelar* para salir.');
    return false;
  }

  const baseSectors = await BaseSector.findAll({ where: { baseId: base.id } });
  const sectorIds = baseSectors.map(bs => bs.sectorId);
  const sectores = await Sector.findAll({ where: { id: sectorIds }, order: [['nombre', 'ASC']] });

  if (sectores.length === 0) {
    await enviarTexto(ctx.telefono, '❌ No hay sectores en esta base. Contactá al administrador.');
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
    return await enviarBotones(ctx.telefono, '👤 Seleccioná tu *sector*:', btns);
  }

  return await enviarLista(
    ctx.telefono,
    '👤 Seleccioná tu *sector*:',
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
  if (ctx.buttonId === 'cancelar') return await cancelarRegistro(ctx.telefono);

  const match = ctx.buttonId?.match(/^sector_(\d+)$/);
  if (!match) {
    return await paso2SectorNumerico(ctx);
  }

  const sectorId = parseInt(match[1]);
  const sector = await Sector.findByPk(sectorId);
  if (!sector) return false;

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  ctxData.sectorId = sectorId;
  ctxData.sectorNombre = sector.nombre;

  await guardarUsuario(ctx.telefono, { pasoRegistro: 3, context: ctxData });
  return await enviarTexto(ctx.telefono,
    '👤 Escribí tu *nombre completo*:\n\nEj: `Juan Pérez`\n\nEscribí *cancelar* para salir.');
}

async function paso2SectorNumerico(ctx: Ctx): Promise<boolean> {
  const num = parseInt(ctx.texto?.trim() || '');
  if (isNaN(num) || num < 1) return false;

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  const lastButtons: BtnDef[] | undefined = ctxData._lastButtons;

  if (!lastButtons || num > lastButtons.length || lastButtons[num - 1].id === 'cancelar') {
    await enviarTexto(ctx.telefono, `❌ Opción inválida. Elegí un número del 1 al ${lastButtons?.length || '?'}.`);
    return false;
  }

  const btn = lastButtons[num - 1]; 
  const match = (btn.id as string).match(/^sector_(\d+)$/);
  if (!match) return false;

  ctxData.sectorId = parseInt(match[1]);
  ctxData.sectorNombre = btn.title;

  await guardarUsuario(ctx.telefono, { pasoRegistro: 3, context: ctxData });
  return await enviarTexto(ctx.telefono,
    '👤 Escribí tu *nombre completo*:\n\nEj: `Juan Pérez`\n\nEscribí *cancelar* para salir.');
}

async function paso3Nombre(ctx: Ctx): Promise<boolean> {
  if (ctx.texto?.toLowerCase() === 'cancelar') return await cancelarRegistro(ctx.telefono);

  if (!ctx.texto || ctx.texto.length < 3) {
    await enviarTexto(ctx.telefono, '❌ El nombre debe tener al menos 3 caracteres. Escribilo de nuevo:');
    return false;
  }

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  ctxData.nombre = ctx.texto;

  await guardarUsuario(ctx.telefono, { pasoRegistro: 4, context: ctxData });

  return await enviarBotones(ctx.telefono,
    '📧 ¿Querés registrar un *correo electrónico*?',
    [
      { id: 'email_si', title: 'Sí, escribir' },
      { id: 'email_no', title: 'Omitir' },
      { id: 'cancelar', title: 'Cancelar' },
    ],
  );
}

async function paso4Email(ctx: Ctx): Promise<boolean> {
  if (ctx.buttonId === 'cancelar') return await cancelarRegistro(ctx.telefono);

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;

  if (ctx.buttonId === 'email_si') {
    return await enviarTexto(ctx.telefono, 'Escribí tu *correo electrónico*:\n\nEscribí *cancelar* para salir.');
  }

  if (ctx.buttonId === 'email_no') {
    ctxData.email = '';
    await guardarUsuario(ctx.telefono, { pasoRegistro: 5, context: ctxData });
    return await mostrarPaso5Rol(ctx.telefono);
  }

  if (ctx.texto?.toLowerCase() === 'cancelar') return await cancelarRegistro(ctx.telefono);

  if (ctx.texto && ctx.texto.includes('@')) {
    ctxData.email = ctx.texto;
    await guardarUsuario(ctx.telefono, { pasoRegistro: 5, context: ctxData });
    return await mostrarPaso5Rol(ctx.telefono);
  }

  await enviarTexto(ctx.telefono, '❌ Eso no parece un email válido. Escribí uno con @ (ej: nombre@correo.com):');
  return false;
}

async function mostrarPaso5Rol(telefono: string): Promise<boolean> {
  return await enviarBotones(telefono,
    '🛡️ Seleccioná tu *rol*:\n\n' +
    '👤 *Agente* — Reporta incidencias\n' +
    '🔧 *Admin* — Gestiona tickets y panel',
    [
      { id: 'rol_agente', title: 'Agente' },
      { id: 'rol_admin', title: 'Admin' },
      { id: 'cancelar', title: 'Cancelar' },
    ],
  );
}

async function paso5Rol(ctx: Ctx): Promise<boolean> {
  if (ctx.buttonId === 'cancelar') return await cancelarRegistro(ctx.telefono);

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;

  if (ctx.buttonId === 'rol_agente') {
    ctxData.esAdmin = false;
    await guardarUsuario(ctx.telefono, { pasoRegistro: 7, context: ctxData });
    return await mostrarConfirmacion(ctx.telefono, ctxData);
  }

  if (ctx.buttonId === 'rol_admin') {
    ctxData.esAdmin = true;
    await guardarUsuario(ctx.telefono, { pasoRegistro: 6, context: ctxData });
    return await enviarTexto(ctx.telefono,
      '🛡️ *Admin requiere autorización*\n\n' +
      'Ingresá el *código de administrador*:\n\n' +
      'Escribí *cancelar* para volver atrás.');
  }

  return false;
}

async function paso6CodigoAdmin(ctx: Ctx): Promise<boolean> {
  if (ctx.texto?.toLowerCase() === 'cancelar') {
    const user = await obtenerUsuario(ctx.telefono);
    const ctxData = (user.context || {}) as any;
    ctxData.esAdmin = false;
    await guardarUsuario(ctx.telefono, { pasoRegistro: 5, context: ctxData });
    return await mostrarPaso5Rol(ctx.telefono);
  }

  const adminCode = getSetting('adminCode') || config.adminCode;
  if (ctx.texto?.trim() !== adminCode) {
    await enviarTexto(ctx.telefono, '❌ Código de admin incorrecto. Intentá de nuevo o escribí *cancelar* para volver.');
    return false;
  }

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;
  ctxData.esAdmin = true;
  ctxData.adminCodeOk = true;
  await guardarUsuario(ctx.telefono, { pasoRegistro: 7, context: ctxData });
  return await mostrarConfirmacion(ctx.telefono, ctxData);
}

async function mostrarConfirmacion(telefono: string, ctx: any): Promise<boolean> {
  const rol = ctx.esAdmin ? '🛡️ Admin' : '👤 Agente';
  const email = ctx.email ? `📧 ${ctx.email}` : '📧 No registrado';
  return await enviarBotones(telefono,
    '✅ *Confirmá tus datos:*\n\n' +
    `👤 *Nombre:* ${ctx.nombre}\n` +
    `🏢 *Base:* ${ctx.baseNombre}\n` +
    `⚙️ *Sector:* ${ctx.sectorNombre}\n` +
    `${rol}\n` +
    `${email}\n\n` +
    '¿Está todo correcto?',
    [
      { id: 'conf_si', title: 'Confirmar' },
      { id: 'conf_no', title: 'Cancelar' },
    ],
  );
}

async function paso7Confirmar(ctx: Ctx): Promise<boolean> {
  if (ctx.buttonId === 'conf_no' || ctx.buttonId === 'cancelar') {
    return await cancelarRegistro(ctx.telefono);
  }
  if (ctx.buttonId !== 'conf_si') return false;

  const user = await obtenerUsuario(ctx.telefono);
  const ctxData = (user.context || {}) as any;

  const esAdmin = ctxData.esAdmin || (config.superAdminPhone && ctx.telefono === config.superAdminPhone);

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

  return await enviarTexto(ctx.telefono,
    '✅ *¡Registro completo!*\n\n' +
    `Ya estás registrado en *${ctxData.baseNombre}* (${ctxData.sectorNombre}).\n\n` +
    'Escribí *ayuda* para ver los comandos disponibles.');
}
