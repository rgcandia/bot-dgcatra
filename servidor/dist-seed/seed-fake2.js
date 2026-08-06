"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var models_js_1 = require("./models/models.js");
var database_js_1 = require("./config/database.js");
var asuntos = ['No prende la impresora', 'Internet caido', 'No tengo acceso al sistema', 'La PC no enciende', 'Monitor parpadea', 'Teclado no funciona', 'Mouse no responde', 'No puedo imprimir', 'El lector de huellas no reconoce', 'La camara no funciona', 'No abre el expediente digital', 'Alta de nuevo usuario', 'Cambio de contrasena bloqueado', 'VPN desconectada', 'Actualizacion de software pendiente', 'Falla en el sistema de turnos', 'Problema con el correo', 'No se sincroniza el calendario', 'Error en el formulario de carga', 'Sistema lento'];
var ubis = ['Oficina 1', 'Oficina 3', 'Entrada principal', 'Recepcion', 'Primer piso', 'Sala de reuniones', 'Pasillo central', 'Deposito', 'Garaje', 'Comedor'];
var estados = ['abierto', 'en_proceso', 'cerrado'];
var prios = ['baja', 'media', 'alta'];
var usuarios = [
    { tel: '5491166086501', nombre: 'Juan Perez', baseId: 1, sectorId: 1 },
    { tel: '5491166086502', nombre: 'Maria Garcia', baseId: 1, sectorId: 2 },
    { tel: '5491166086503', nombre: 'Carlos Lopez', baseId: 1, sectorId: 1 },
    { tel: '5491166086504', nombre: 'Ana Martinez', baseId: 2, sectorId: 1 },
    { tel: '5491166086505', nombre: 'Pedro Rodriguez', baseId: 2, sectorId: 2 },
    { tel: '5491166086506', nombre: 'Laura Fernandez', baseId: 1, sectorId: 1 },
    { tel: '5491166086507', nombre: 'Diego Gonzalez', baseId: 2, sectorId: 1 },
    { tel: '5491166086508', nombre: 'Sofia Diaz', baseId: 1, sectorId: 2 },
    { tel: '5491166086509', nombre: 'Martin Alvarez', baseId: 2, sectorId: 1 },
    { tel: '5491166086510', nombre: 'Valentina Ruiz', baseId: 1, sectorId: 1 },
    { tel: '5491166086511', nombre: 'Lucas Sanchez', baseId: 2, sectorId: 2 },
    { tel: '5491166086512', nombre: 'Camila Torres', baseId: 1, sectorId: 1 },
];
var now = Date.now();
var tickets = [];
for (var i = 0; i < 64; i++) {
    var u = usuarios[Math.floor(Math.random() * 12)];
    var a = asuntos[Math.floor(Math.random() * 20)];
    var ub = ubis[Math.floor(Math.random() * 10)];
    var est = estados[Math.floor(Math.random() * 3)];
    var pr = prios[Math.floor(Math.random() * 3)];
    var dias = Math.floor(Math.random() * 180);
    var f = new Date(now - dias * 86400000 - Math.random() * 86400000);
    var desc = a + ' desde hace 2 dias. Intente reiniciar pero no funciono.';
    var sol = est === 'cerrado' ? 'Se actualizo el driver y se reinicio el equipo.' : null;
    var tec = (est === 'en_proceso' || est === 'cerrado') ? u.nombre : null;
    var hist = [{ accion: u.nombre + ' creo el ticket', autor: u.nombre, timestamp: f.toISOString() }];
    if (est !== 'abierto') {
        hist.push({ accion: u.nombre + ' se asigno como tecnico', autor: u.nombre, timestamp: new Date(f.getTime() + 3600000).toISOString() });
    }
    if (est === 'cerrado') {
        hist.push({ accion: u.nombre + ' puso en proceso el ticket', autor: u.nombre, timestamp: new Date(f.getTime() + 7200000).toISOString() });
        hist.push({ accion: u.nombre + ' registro la solucion', autor: u.nombre, timestamp: new Date(f.getTime() + 10800000).toISOString() });
        hist.push({ accion: u.nombre + ' cerro el ticket', autor: u.nombre, timestamp: new Date(f.getTime() + 14400000).toISOString() });
    }
    tickets.push({
        asunto: a,
        descripcion: desc,
        ubicacion: ub,
        estado: est,
        prioridad: pr,
        baseId: u.baseId,
        sectorId: u.sectorId,
        userTelefono: u.tel,
        tecnicoAsignado: tec,
        solucion: sol,
        historial: hist,
        createdAt: f,
        updatedAt: f,
    });
}
await models_js_1.Ticket.bulkCreate(tickets);
console.log('✅ Tickets adicionales creados:', tickets.length);
console.log('Total tickets:', await models_js_1.Ticket.count());
await database_js_1.sequelize.close();
