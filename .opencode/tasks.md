# Tareas - bot-dgcatra

## Pendiente

### Modelo de negocio
- [ ] Definir flujo completo del bot (registro → creación de tickets → cierre)
- [ ] Definir si los tickets se crean solo por bot o también desde el dashboard
- [ ] Definir estados del ticket (abierto / en curso / cerrado)
- [ ] Definir prioridades (baja / media / alta)

### Bot WhatsApp (cuando haya número)
- [ ] Conectar con número de WhatsApp de producción
- [ ] Comando /ticket completo con persistencia en DB
- [ ] Comando /mis-tickets para ver tickets del usuario
- [ ] Comando /cerrar para cerrar un ticket
- [ ] Integrar Groq IA para conversación natural
- [ ] Enviar código de auth por WhatsApp (hoy solo se loguea en consola)
- [ ] Migrar a número de WhatsApp producción

### Frontend (cuando se necesite)
- [ ] Agregar rutas para CRUD (bases, sectores, usuarios)
- [ ] Página de tickets con filtros
- [ ] Detalle de ticket con historial
- [ ] Estadísticas con gráficos
- [ ] Socket.IO en frontend para tiempo real
- [ ] Deploy en Vercel

### Infra
- [ ] Socket.IO en frontend (falta socket.io-client y conexión)
- [ ] Dashboard administración frontend (estadísticas, gestión)

---

## En progreso

### 2026-07-14 — Limpieza y restructuración

#### Backend — Seguridad
- [x] Fix: `esAdmin: true` hardcodeado en JWT → usar valor real de la DB
- [x] Fix: Mass assignment → whitelist de campos permitidos en cada update
- [x] Fix: Agregar try-catch a todos los controllers (bases, sectores, roles, usuarios, tickets, stats)
- [x] Fix: Config centralizado (JWT_SECRET en un solo archivo `config/index.ts`)
- [x] Fix: Error handler global de Express (devuelve JSON, no HTML)
- [x] Fix: Validación de env vars al arrancar
- [x] Fix: Super admin desde env var `SUPER_ADMIN_PHONE`

#### Backend — Modelo de datos
- [x] Simplificar: eliminar tabla `roles` (usar `esAdmin` para admin vs usuario)
- [x] Crear tabla `conversaciones` para historial del bot
- [x] Actualizar seed.ts con nuevo modelo

#### Backend — Flujo de registro
- [x] Nuevo flujo: código de base → sector → nombre → email (opcional)
- [x] Código de acceso por base (no por rol)
- [x] Super admin automático por `SUPER_ADMIN_PHONE`

#### Backend — Infra
- [x] Quitar puertos de Redis y PostgreSQL del docker-compose (solo internos)
- [x] Actualizar .env.example con variables necesarias

#### Frontend
- [x] Dejar estructura base vacía (React + TypeScript + Vite)
- [x] Mantener: api/client.ts, AuthContext.tsx, Layout básico
- [x] Eliminar: todas las pages de CRUD, stats, tickets

#### Documentación
- [x] Actualizar README.md
- [x] Actualizar tasks.md

---

## Completadas

### 2026-07-06 — Infraestructura
- [x] README inicial del proyecto
- [x] Creación de estructura .opencode (instructions + tasks)
- [x] Inicializar proyecto Node.js/TypeScript
- [x] Configurar docker-compose (redis, db, api, workers)
- [x] Implementar API Madre con Express (webhook Meta + health)
- [x] Configurar BullMQ (cola de mensajes)
- [x] Implementar Workers de procesamiento básico
- [x] Configurar Redis con persistencia AOF
- [x] Seed de datos inicial (2 bases, 6 sectores, 2 roles)

### 2026-07-06 — Backend (servidor/)
- [x] Crear modelo de datos (Base, Sector, BaseSector, Rol, User, Ticket)
- [x] Ticket model: sectorId, tecnicoAsignado, solucion, historial (JSON)
- [x] Asociaciones Sequelize: User → Base/Sector/Rol, Ticket → User/Base/Sector
- [x] Socket.IO en servidor con CORS
- [x] Auth JWT: solicitar-codigo + verificar-codigo (código en Redis 5min TTL)
- [x] CRUD Bases, Sectores, Roles
- [x] CRUD Usuarios (incluye base, sector, rol)
- [x] CRUD Tickets (filtros, historial con accion/timestamp, Socket.IO en vivo)
- [x] Estadísticas (resumen, por base, por mes, top usuarios)

### 2026-07-06 — Frontend (cliente/)
- [x] Login 2 pasos (teléfono → código → JWT)
- [x] Dashboard con sidebar
- [x] Tickets list con filtros (estado, prioridad, base, sector)
- [x] Ticket detail con edición e historial
- [x] Estadísticas con gráficos (Recharts)
- [x] CRUD Bases, Sectores, Roles (modal)
- [x] Usuarios list con filtros

### 2026-07-07 — WhatsApp Webhook
- [x] Solicitar credenciales de Meta (APP_ID, APP_SECRET, etc.)
- [x] Configurar .env con credenciales de Meta
- [x] Agregar JWT_SECRET a .env y .env.example
- [x] Configurar webhook en dashboard de Meta (URL + verify token)
- [x] Registrar suscripción del webhook vía API (subscribed_apps)
- [x] Verificar recepción de mensajes reales en workers de BullMQ

### 2026-07-06 — Tunnel & Deploy
- [x] DNS CNAME: dgcatra.alejndrogcandia.online → tunnel
- [x] Config remota del tunnel (ingress via API de Cloudflare)
- [x] cliente/.env con VITE_API_URL=https://dgcatra.alejndrogcandia.online
- [x] CORS en API y Socket.IO (tunnel + localhost)
- [x] Eliminar cloudflared del docker-compose (corre como systemd en host)
- [x] README actualizado con estructura, rutas, tunnel y deploy

### 2026-07-07 — Bot WhatsApp: registro + envío
- [x] Helper enviar.ts: texto, botones (hasta 3), listas
- [x] Router bot/index.ts: mensajes → registrados vs no registrados
- [x] Endpoint POST /api/bot/token (actualizar token en memoria)
- [x] Bot recibe mensajes vía webhook + procesa con BullMQ
- [x] Fix formateo número WhatsApp (549 → sin 9, test number)
- [x] Refactor registro.ts: 7 pasos con switch, cancelar en cada paso
- [x] Nueva secuencia registro: Base → Sector → Nombre → Email (opcional) → Rol → Código → Confirmar
