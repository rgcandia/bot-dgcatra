# Análisis completo del proyecto bot-dgcatra

> Generado el 2026-08-08

---

## 1. Qué hace el bot

Sistema de **tickets vía WhatsApp** para el área de Sistemas del Cuerpo de Agentes de Tránsito de GCBA, Buenos Aires. Presupuesto $0.

**Flujo principal:**
1. Agentes de campo reportan problemas de IT por WhatsApp
2. El bot los guía por un flujo de registro (código de base → sector → código admin opcional → nombre)
3. Luego crean tickets (describir problema → ubicación → confirmar)
4. Los admins de IT gestionan tickets desde un dashboard web React
5. Notificaciones en tiempo real vía Socket.IO

**Capacidades clave:**
- Registro multi-paso con códigos de acceso por base y código de autorización admin
- Ciclo de vida de tickets: abierto → en_proceso → cerrado
- "Chat takeover": admins toman control de la conversación desde el dashboard y chatean directamente con el agente
- Login al dashboard vía OTP por WhatsApp (6 dígitos) + código maestro de respaldo
- Notificaciones en tiempo real (sonido + toast)
- Roles: usuario regular, admin, super admin

---

## 2. Stack tecnológico

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| **Backend** | Node.js + TypeScript | `strict: true`, ES2022 |
| **Web framework** | Express 4 | REST API |
| **Bot WhatsApp** | whatsapp-web.js 1.34.7 | WhatsApp Web no oficial vía Puppeteer |
| **Navegador** | Puppeteer (Chrome) | Headless en Docker |
| **Base de datos** | PostgreSQL 16 | Sequelize ORM |
| **Tiempo real** | Socket.IO 4.8 | JWT-authenticated WebSocket |
| **Auth** | JWT (jsonwebtoken) | 24h, auto-logout tras 30min inactividad |
| **Logging** | Pino 10.3 | JSON estructurado + pino-pretty en dev |
| **Validación** | Zod | Schemas para contextos del bot |
| **Rate limiting** | express-rate-limit | Endpoints de auth protegidos |
| **Frontend** | React 18 + TypeScript | Vite 6 |
| **Charts** | Recharts 2.14 | Pie + bar charts |
| **Íconos** | Lucide React | SVG icons profesionales |
| **Contenedores** | Docker + Docker Compose | 2 servicios: api + db |
| **Túnel** | Cloudflare Tunnel (cloudflared) | Expone localhost:4002 |
| **Hosting frontend** | Vercel | bot-dgcatra.vercel.app |
| **Tests** | Vitest | 9 tests unitarios para schemas Zod |
| **QR** | qrcode-terminal + qrserver.com | Terminal + dashboard |

---

## 3. Estructura del proyecto

```
bot-dgcatra/
├── README.md                     # Documentación completa (298 líneas)
├── .opencode/
│   ├── tasks.md                  # Bitácora detallada de tareas
│   ├── instructions.md
│   └── analisis.md               # Este archivo
├── cliente/                      # Frontend React + Vite + TypeScript
│   ├── .env                      # VITE_API_URL
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json               # Deploy en Vercel
│   ├── src/
│   │   ├── main.tsx              # Entry point: BrowserRouter + AuthProvider
│   │   ├── App.tsx               # Definición de rutas
│   │   ├── index.css             # ~200 líneas de CSS (design system)
│   │   ├── api/client.ts         # Wrapper fetch con JWT
│   │   ├── context/
│   │   │   ├── AuthContext.tsx    # Estado auth, login, logout, inactividad
│   │   │   └── useSocket.ts      # Hook Socket.IO
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx # Sidebar + hamburger + toast notificaciones
│   │   ├── components/
│   │   │   ├── NavItem.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── ConfirmButton.tsx
│   │   └── pages/
│   │       ├── LoginPage.tsx      # 3 pasos: admin → OTP → verificar
│   │       ├── DashboardHome.tsx  # Stats + Recharts
│   │       ├── TicketsList.tsx    # Tabla con filtros
│   │       ├── TicketDetail.tsx   # Vista completa + chat takeover
│   │       └── admin/
│   │           ├── BasesPage.tsx
│   │           ├── SectoresPage.tsx
│   │           ├── UsuariosPage.tsx
│   │           └── SettingsPage.tsx
│   └── public/
│       ├── logo-small.png
│       └── logo-large.png
└── servidor/                     # Backend Express + TypeScript
    ├── .env                      # Variables de entorno (producción)
    ├── .env.example
    ├── Dockerfile                # Multi-stage: builder + runner con Chrome
    ├── docker-compose.yml        # api + postgres:16-alpine
    ├── package.json
    ├── tsconfig.json
    ├── .wwebjs_auth/             # Sesión de WhatsApp (bind-mounted)
    └── src/
        ├── api/index.ts          # Entry point Express, CORS, graceful shutdown
        ├── seed.ts               # Seeder (2 bases + 3 sectores)
        ├── reset-db.ts           # Force-reset de tablas
        ├── __tests__/
        │   └── schemas.test.ts   # 9 tests de schemas Zod
        ├── config/
        │   ├── index.ts          # Env vars centralizadas + validación
        │   ├── database.ts       # Sequelize + PostgreSQL pool
        │   ├── logger.ts         # Pino logger
        │   └── settings.ts       # Settings mutables en runtime (masterCode, adminCode)
        ├── models/
        │   ├── Base.ts
        │   ├── Sector.ts
        │   ├── User.ts
        │   ├── Ticket.ts
        │   ├── Conversacion.ts
        │   └── models.ts         # Asociaciones + barrel export
        ├── middleware/
        │   ├── auth.ts           # JWT + blacklist de baneados
        │   └── admin.ts          # Guard de admin
        ├── routes/
        │   ├── auth.routes.ts
        │   ├── bases.routes.ts
        │   ├── sectores.routes.ts
        │   ├── usuarios.routes.ts
        │   ├── tickets.routes.ts
        │   ├── chat.routes.ts
        │   ├── stats.routes.ts
        │   └── settings.routes.ts
        ├── controllers/
        │   ├── auth.controller.ts
        │   ├── bases.controller.ts
        │   ├── sectores.controller.ts
        │   ├── usuarios.controller.ts
        │   ├── tickets.controller.ts
        │   ├── chat.controller.ts
        │   ├── stats.controller.ts
        │   └── settings.controller.ts
        ├── socket/
        │   └── server.ts          # Socket.IO con JWT auth, eventos bot status/QR
        └── bot/
            ├── whatsapp.ts        # Cliente WhatsApp Web, QR, reconnect, eventos
            ├── index.ts           # Router de mensajes: cola FIFO, dedup, botones
            ├── session.ts         # Cache de usuarios (60s TTL), cleanup (60min)
            ├── schemas.ts         # Schemas Zod: TicketContext, RegisterContext, PendingCommand
            ├── enviar.ts          # sendMessage con typing, rate limiting, fallback botones
            ├── historial.ts       # Persistencia de mensajes en Conversacion
            └── handlers/
                ├── registro.ts    # Flujo de registro 6 pasos
                ├── ticket.ts      # Flujo de ticket 4 pasos
                └── comandos.ts    # Comandos de usuario registrado
```

---

## 4. Puntos de entrada

| Punto de entrada | Archivo | Descripción |
|-----------------|---------|-------------|
| **Backend** | `servidor/src/api/index.ts` | Arranca Express, monta rutas, inicia Socket.IO, sincroniza DB, inicia bot WhatsApp. Puerto 4002. |
| **Frontend** | `cliente/src/main.tsx` | React DOM con BrowserRouter + AuthProvider. |
| **App React** | `cliente/src/App.tsx` | Rutas: `/login`, `/`, `/tickets`, `/tickets/:id`, `/admin/*`. |
| **Bot WhatsApp** | `servidor/src/bot/whatsapp.ts` | Client de whatsapp-web.js con LocalAuth + Puppeteer. Eventos: qr, ready, auth_failure, disconnected, message. |
| **Seeder** | `servidor/src/seed.ts` | `npm run seed` — crea 2 bases y 3 sectores. |
| **Docker** | `servidor/docker-compose.yml` | 2 servicios: api + db. |
| **Vercel** | `cliente/vercel.json` | Build de Vite, SPA rewrites. |

### npm scripts

**Backend:**
- `npm run dev` — `tsx watch src/api/index.ts` (hot-reload)
- `npm run build` — `tsc`
- `npm start` — `node dist/api/index.js`
- `npm run seed` — `node dist/seed.js`
- `npm test` — `vitest run`

**Frontend:**
- `npm run dev` — `vite` (puerto 5173)
- `npm run build` — `tsc && vite build`

---

## 5. Variables de entorno

### Servidor (`.env`)

| Variable | Valor actual | Requerida | Descripción |
|----------|-------------|-----------|-------------|
| `PORT` | `4002` | Sí | Puerto del servidor |
| `JWT_SECRET` | `dgcatra-secret-prod-...` | **Sí** | Secreto para firmar JWT |
| `DATABASE_URL` | `postgresql://dgcatra:dgcatra@db:5432/dgcatra` | **Sí** | Conexión PostgreSQL |
| `SUPER_ADMIN_PHONE` | (vacío) | No | Teléfono del super admin |
| `MASTER_CODE` | `202428` | No | Código backup para login dashboard |
| `FRONTEND_URL` | `https://bot-dgcatra.vercel.app` | No | CORS adicional |
| `ADMIN_CODE` | `admin2024` | No | Código para registro de admins |

### Cliente (`.env`)

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://dgcatra.alejndrogcandia.online` |

### Docker Compose (adicional)

- `CHROME_CRASHPAD_HANDLER=/dev/null` — desactiva crash reports de Chrome
- `TZ=America/Argentina/Buenos_Aires`
- `shm_size=2gb` — memoria compartida para Chrome headless

---

## 6. Dependencias

### Backend (producción)

| Paquete | Versión | Uso |
|---------|---------|-----|
| express | ^4.21 | HTTP framework |
| cors | ^2.8 | CORS |
| express-rate-limit | ^8.6 | Rate limiting |
| jsonwebtoken | ^9.0 | JWT auth |
| whatsapp-web.js | ^1.34 | Cliente WhatsApp |
| qrcode-terminal | ^0.12 | QR en terminal |
| sequelize | ^6.37 | ORM |
| pg | ^8.13 | Driver PostgreSQL |
| dotenv | ^16.4 | Cargar .env |
| pino | ^10.3 | Logging |
| pino-pretty | ^13.1 | Logs en dev |
| socket.io | ^4.8 | WebSocket |

### Backend (dev)

| Paquete | Uso |
|---------|-----|
| typescript 5.7 | Compilador |
| tsx 4.19 | Ejecutor TypeScript en dev |
| vitest 4.1 | Test runner |
| @types/* | Tipos |
| sharp | Procesamiento de imágenes |

### Frontend (producción)

| Paquete | Versión | Uso |
|---------|---------|-----|
| react | ^18.3 | UI library |
| react-dom | ^18.3 | DOM renderer |
| react-router-dom | ^6.28 | Routing |
| recharts | ^2.14 | Charts |
| lucide-react | ^1.28 | Íconos |
| socket.io-client | ^4.8 | WebSocket client |

---

## 7. Mecanismos internos

### Anti-detección de WhatsApp (en `bot/enviar.ts`)

- **Simulación de tipeo**: vía `pupPage.evaluate()` con `WAWebChatStateBridge.sendChatStateComposing()` (bypassea el roto `sendStateTyping`)
- **Delay**: `1500 + text.length * 15 + random(0, 2000)` ms
- **Rate limit**: máx 1 mensaje cada 2s por usuario
- **Recibos de lectura**: `chat.sendSeen()` antes de procesar
- **Botones emulados**: texto con números emoji (WhatsApp native Buttons está deprecado)

### Router de mensajes (`bot/index.ts`)

- **Deduplicación**: Set con TTL de 15s
- **Cola FIFO por usuario**: `Map<string, Promise>` para procesamiento secuencial
- **Detección de chat takeover**: si `chatConAdmin` está activo, redirige a Socket.IO en vez de handlers
- **Parseo de botones/SMS**: `parsearBotonNumerico`

### Sesiones (`bot/session.ts`)

- Cache en memoria con TTL de 60s
- Cleanup de sesiones tras 60min de inactividad
- `User.upsert()` a PostgreSQL

### Chat takeover (`chat.controller.ts`)

- Admin inicia con `POST /api/tickets/:id/chat/iniciar`
- El bot deja de responder y reenvía mensajes entrantes al dashboard vía Socket.IO
- Admin envía respuestas desde el dashboard vía `POST /api/tickets/:id/chat/enviar`
- Timeout de inactividad de 5 minutos — devuelve control al bot
- Finalización manual con `POST /api/tickets/:id/chat/finalizar`

### Settings en runtime (`config/settings.ts`)

- `Map<string, string>` para `masterCode` y `adminCode`
- Modificables desde el Settings Page sin reiniciar el servidor
- Inicializados desde env vars al arrancar

### Auto-reconexión del bot (`bot/whatsapp.ts`)

- 5 intentos, delay de 30s entre cada uno
- Si la sesión es válida (`.wwebjs_auth`), reconecta sin QR
- Si hay `auth_failure`, se detiene y requiere nuevo escaneo QR

### Socket.IO (`socket/server.ts`)

- JWT-authenticated
- Eventos emitidos:
  - `bot-status`, `bot-qr`
  - `ticket-creado`, `ticket-actualizado`, `ticket-asignado`
  - `usuario-registrado`, `datos-actualizados`
  - `chat-mensaje-entrante`, `chat-estado`

---

## 8. Arquitectura de flujo

```
[WhatsApp User]
    │ (mensaje WhatsApp)
    ▼
[Puppeteer/Chrome - WhatsApp Web] (bot/whatsapp.ts)
    │ Client.on('message')
    ▼
[Message Router] (bot/index.ts)
  ├── Deduplicación (Set, TTL 15s)
  ├── Cola FIFO por usuario
  ├── Read receipt (sendSeen)
  ├── Parseo de botones/SMS
  └── Chat takeover check
    │
    ├──▶ [Session Layer] (bot/session.ts)
    │      ├── Cache (Map, TTL 60s)
    │      ├── Expiración (60min)
    │      ├── User.upsert() → PostgreSQL
    │      └── Message log (bot/historial.ts → Conversacion)
    │
    └──▶ [Handler Dispatcher]
           │
           ├── !registroCompleto → handlers/registro.ts (6 pasos)
           │     Paso 0: Bienvenida + botón iniciar
           │     Paso 1: Código de base (PIE2026/ONC2026)
           │     Paso 2: Sector (botones/lista)
           │     Paso 3: Código admin (si isAdmin)
           │     Paso 4: Nombre completo
           │     Paso 6: Confirmación → User guardado
           │
           └── registroCompleto:
                 ├── handlers/comandos.ts
                 │     Menú, Ayuda, Mis Tickets, Ticket N, Cerrar N
                 │     Estado de comando pendiente para flujos 2-pasos
                 │
                 └── handlers/ticket.ts (fallback: texto no reconocido)
                       INICIAR → PEDIR_DESCRIPCION → PEDIR_UBICACION → CONFIRMAR
                       → Ticket creado en DB → Socket.IO emit
                       → Notificación WhatsApp al agente

[Express API] (api/index.ts)
  └── REST endpoints en /api/*

[Socket.IO Server] (socket/server.ts)
  └── JWT-authenticated real-time events

[PostgreSQL] (Sequelize ORM)
  Tablas: bases, sectores, usuarios, tickets, conversaciones
  Relaciones: User→Base, User→Sector, Ticket→User, Ticket→Base,
              Ticket→Sector, Conversacion→User, Conversacion→Ticket

[Frontend React]
  ├── AuthContext → JWT en localStorage + 30min inactivity auto-logout
  ├── useSocket → Socket.IO hook para real-time
  ├── DashboardLayout → sidebar + notificaciones toast
  └── Pages → Login, DashboardHome, TicketsList, TicketDetail, Admin CRUD
```

---

## 9. Conexiones clave entre módulos

1. **Bot → DB**: `bot/index.ts` → `bot/session.ts` (cache + DB) → handlers → `bot/enviar.ts` (envío) + `bot/historial.ts` (Conversacion)

2. **Socket.IO bridge**: `getIO()` usado por controllers y handlers para emitir eventos en tiempo real

3. **Chat takeover**: Inicia vía API REST → setea `chatConAdmin` en DB → bot redirige mensajes a Socket.IO → admin responde vía API → timeout 5min o finalización manual

4. **Settings runtime**: `Map` en memoria modificable vía API, inicializado desde env vars

5. **Auto-reconexión**: Loop de 5 intentos con delay, sesión persistida en volumen `.wwebjs_auth`
