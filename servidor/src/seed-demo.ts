import 'dotenv/config';
import { sequelize, Base, Sector, User, Ticket, Conversacion } from './models/models.js';

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rand(8, 18), rand(0, 59), rand(0, 59));
  return d;
}

async function seed() {
  console.log('🧹 Limpiando DB...');
  await sequelize.sync({ force: true });

  // --- Bases ---
  const bases = await Promise.all([
    Base.create({ nombre: 'Base Piedras', direccion: 'Av. Piedras 123, CABA', codigoAcceso: 'PIE2026' }),
    Base.create({ nombre: 'Base Once', direccion: 'Av. Rivadavia 456, CABA', codigoAcceso: 'ONC2026' }),
    Base.create({ nombre: 'Base Constituyentes', direccion: 'Av. Constituyentes 789, CABA', codigoAcceso: 'CON2026' }),
    Base.create({ nombre: 'Base Retiro', direccion: 'Av. Ramos Mejía 321, CABA', codigoAcceso: 'RET2026' }),
  ]);
  console.log(`  ✅ ${bases.length} bases`);

  // --- Sectores ---
  const sectores = await Promise.all([
    Sector.create({ nombre: 'Operativo' }),
    Sector.create({ nombre: 'Administrativo' }),
    Sector.create({ nombre: 'Soporte Técnico', isAdmin: true, codigoAdmin: 'admin2024' }),
  ]);
  console.log(`  ✅ ${sectores.length} sectores`);

  // --- Admins (Soporte Técnico) ---
  const admins = await Promise.all([
    User.create({ telefono: '5491112345678', nombreCompleto: 'Ale Candia', baseId: bases[0].id, sectorId: sectores[2].id, esAdmin: true, registroCompleto: true, pasoRegistro: 6, activo: true }),
    User.create({ telefono: '5491123456789', nombreCompleto: 'María López', baseId: bases[1].id, sectorId: sectores[2].id, esAdmin: true, registroCompleto: true, pasoRegistro: 6, activo: true }),
    User.create({ telefono: '5491134567890', nombreCompleto: 'Carlos Ruiz', baseId: bases[2].id, sectorId: sectores[2].id, esAdmin: true, registroCompleto: true, pasoRegistro: 6, activo: true }),
    User.create({ telefono: '5491145678901', nombreCompleto: 'Laura Díaz', baseId: bases[3].id, sectorId: sectores[2].id, esAdmin: true, registroCompleto: true, pasoRegistro: 6, activo: true }),
  ]);
  console.log(`  ✅ ${admins.length} admins`);

  // --- Agentes normales ---
  const nombresAgentes = [
    'Juan Pérez', 'Ana García', 'Pedro Gómez', 'Sofía Martínez',
    'Diego Fernández', 'Lucía Sánchez', 'Martín Torres', 'Valentina Rojas',
    'Federico Álvarez', 'Camila Castro', 'Nicolás Herrera', 'Florencia Vega',
    'Emiliano Morales', 'Julieta Ramos', 'Gonzalo Silva', 'Bárbara Flores',
  ];
  const agentes = await Promise.all(
    nombresAgentes.map((nombre, i) =>
      User.create({
        telefono: `549115${String(i).padStart(7, '0')}`,
        nombreCompleto: nombre,
        baseId: pick(bases).id,
        sectorId: pick([sectores[0], sectores[1]]).id,
        esAdmin: false,
        registroCompleto: true,
        pasoRegistro: 4,
        activo: true,
      }),
    ),
  );
  const todos = [...admins, ...agentes];
  console.log(`  ✅ ${agentes.length} agentes (${todos.length} usuarios total)`);

  // --- Tickets ---
  const asuntos = [
    'Impresora no responde',
    'No puedo acceder al sistema de multas',
    'La PC se reinicia sola',
    'Monitor parpadea constantemente',
    'Teclado no funciona',
    'No tengo acceso a la VPN',
    'El lector de huellas no reconoce',
    'Error al imprimir actas',
    'Sistema lento al cargar formularios',
    'No se sincronizan los datos con el servidor',
    'Mouse no responde',
    'Problema con la firma digital',
    'Cámara de vigilancia offline',
    'Router sin conexión a internet',
    'Actualización de Windows falló',
    'Error 500 al consultar padrones',
    'Base de datos de licencias inaccesible',
    'Pantalla azul al abrir el gestor de turnos',
    'Impresora fiscal atascada',
    'Conexión intermitente en toda la base',
    'Microfono no funciona en videollamada',
    'No recibo notificaciones del sistema',
    'Token de autenticación expirado',
    'Registro duplicado en padrón vehicular',
    'App móvil crashea al escanear QR',
  ];

  const descripciones = [
    'Desde ayer a la mañana dejó de funcionar. Probé reiniciando pero sigue igual.',
    'Ocurre cada vez que abro el módulo de consultas. Adjunto captura.',
    'Empezó después de la última actualización. Nadie más en la base reportó el problema.',
    'Viene pasando hace varios días de forma intermitente. A veces funciona y a veces no.',
    'El equipo tiene menos de 6 meses. Ya había pasado antes y se solucionó solo.',
    'Afecta a todo el turno mañana. Los compañeros también tienen el mismo problema.',
    'Probé en otra máquina y funciona bien, así que parece ser un problema local.',
    'Necesito resolverlo urgente porque tengo que cargar 50 actas antes del mediodía.',
    'Ya hice el procedimiento estándar (reiniciar, reconectar) y no mejoró.',
    'El error ocurre siempre en el mismo paso del proceso.',
    'Antes de ayer funcionaba perfecto. No se instaló nada nuevo.',
    'Ya llamé a soporte la semana pasada por esto mismo, pero volvió a fallar.',
    'Todos los equipos del sector de administración están con el mismo síntoma.',
    'El cartucho de tinta es nuevo, no entiendo por qué imprime mal.',
    'Cuando hay mucha gente en la base, el sistema se pone especialmente lento.',
  ];

  const tecnicos = ['Ale Candia', 'María López', 'Carlos Ruiz', 'Laura Díaz'];
  const estados = ['abierto', 'en_proceso', 'cerrado'] as const;
  const prioridades = ['baja', 'media', 'alta'] as const;

  const tickets = [];
  for (let i = 0; i < 200; i++) {
    const createdAt = daysAgo(rand(1, 180)); // 6 meses atrás
    const estado = pick(estados);
    const tecnicoAsignado = estado === 'abierto' ? null : pick(tecnicos);
    const updatedAt = new Date(createdAt.getTime() + rand(60, 300) * 60 * 1000); // +1 a 5 horas después

    const historial: any[] = [{
      accion: `${pick(todos).nombreCompleto} creó el ticket`,
      autor: pick(todos).nombreCompleto,
      timestamp: createdAt.toISOString(),
    }];

    if (estado === 'en_proceso' && tecnicoAsignado) {
      historial.push({
        accion: `${tecnicoAsignado} tomó el caso`,
        autor: tecnicoAsignado,
        timestamp: new Date(createdAt.getTime() + rand(30, 120) * 60 * 1000).toISOString(),
      });
    }

    if (estado === 'cerrado' && tecnicoAsignado) {
      historial.push({
        accion: `${tecnicoAsignado} tomó el caso`,
        autor: tecnicoAsignado,
        timestamp: new Date(createdAt.getTime() + rand(30, 120) * 60 * 1000).toISOString(),
      });
      historial.push({
        accion: `${tecnicoAsignado} cerró el ticket — Solución: ${pick(['Reinicio de equipo', 'Actualización de driver', 'Reconfiguración de red', 'Reemplazo de hardware', 'Parche aplicado', 'Restablecimiento de contraseña', 'Limpieza de caché', 'Reinstalación del software'])}`,
        autor: tecnicoAsignado,
        timestamp: updatedAt.toISOString(),
      });
    }

    const asunto = pick(asuntos) + (rand(0, 2) === 0 ? '' : ` #${rand(100, 999)}`);
    const agente = pick(todos);

    tickets.push({
      asunto,
      descripcion: pick(descripciones),
      ubicacion: pick(['Planta baja', 'Primer piso', 'Segundo piso', 'Oficina central', 'Mostrador', 'Sala de reuniones', 'Entrada principal', 'Depósito']),
      estado,
      prioridad: pick(prioridades),
      baseId: pick(bases).id,
      sectorId: pick([sectores[0], sectores[1]]).id,
      userTelefono: agente.telefono,
      tecnicoAsignado,
      solucion: estado === 'cerrado' ? pick(['Reinicio de equipo', 'Actualización de driver', 'Reconfiguración de red', 'Reemplazo de hardware', 'Parche aplicado', 'Reset de configuración']) : null,
      historial,
      createdAt,
      updatedAt,
    });
  }

  await Ticket.bulkCreate(tickets);
  console.log(`  ✅ ${tickets.length} tickets`);

  // --- Stats ---
  const abiertos = tickets.filter(t => t.estado === 'abierto').length;
  const enProceso = tickets.filter(t => t.estado === 'en_proceso').length;
  const cerrados = tickets.filter(t => t.estado === 'cerrado').length;
  console.log(`     ${abiertos} abiertos / ${enProceso} en proceso / ${cerrados} cerrados`);

  // --- Conversaciones de muestra ---
  const conversaciones: any[] = [];
  const frasesInbound = [
    'Hola, necesito ayuda con esto',
    'Sí, ya lo probé',
    'Gracias, ahora funciona',
    'Sigue sin andar',
    'Ok, dale',
    '¿Cuánto tarda?',
    'Ahí te paso la captura',
    'Perfecto, muchas gracias',
    'No, eso no lo hice',
    'Listo, ya está',
  ];
  const frasesOutbound = [
    'Hola, ¿en qué te puedo ayudar?',
    'Probá reiniciando el equipo',
    '¿Te aparece algún mensaje de error?',
    'Dale, avisame cómo te fue',
    'Ya lo estamos revisando',
    '¿Podés probar de nuevo ahora?',
  ];

  for (let i = 0; i < 60; i++) {
    const ticket = pick(tickets) as any;
    const isInbound = Math.random() < 0.5;
    const ts = new Date(new Date(ticket.createdAt).getTime() + rand(1, 1440) * 60 * 1000);

    conversaciones.push({
      userTelefono: ticket.userTelefono,
      ticketId: ticket.id || null,
      mensaje: pick(isInbound ? frasesInbound : frasesOutbound),
      direccion: isInbound ? 'inbound' : 'outbound',
      createdAt: ts,
    });
  }

  await Conversacion.bulkCreate(conversaciones);
  console.log(`  ✅ ${conversaciones.length} mensajes de conversación`);

  console.log('\n✅ Seed demo completado');
  console.log('   Usá el código maestro para loguearte al dashboard.');
  console.log('   Admins: 5491112345678 (Ale Candia) y otros 3 más.');
  console.log('   Registro por WhatsApp: código de base PIE2026 / ONC2026 / CON2026 / RET2026');

  await sequelize.close();
}

seed().catch((e) => {
  console.error('❌ Error en seed-demo:', e);
  process.exit(1);
});
