# bot-dgcatra

Bot de WhatsApp para la gestión de tickets del sector Sistemas del Cuerpo de Agentes de Tránsito de CABA (GCBA). Presupuesto $0.

---

## Descripción del negocio

Sistema de tickets técnicos interno para el sector Sistemas del Cuerpo de Agentes de Tránsito de CABA. Los agentes reportan incidencias informáticas vía WhatsApp y el equipo de Sistemas las gestiona desde un dashboard web.

---

## Modelo de datos

### usuarios
| Campo | Tipo | Descripción |
|-------|------|-------------|
| telefono | PK string | Teléfono del usuario |
| nombreCompleto | string | Nombre |
| email | string | Email (opcional) |
| baseId | int FK | Base a la que pertenece |
| sectorId | int FK | Sector al que pertenece |
| esAdmin | boolean | Si puede ver el dashboard |
| registroCompleto | boolean | Si terminó el registro |
| pasoRegistro | int | Paso actual del registro |
| context | JSON | Datos temporales del registro |

### bases
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| nombre | string | Nombre de la base |
| direccion | string | Dirección |
| codigoAcceso | string | Código para registrarse en esta base |

### sectores
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| nombre | string | Nombre del sector |

### base_sector (muchos a muchos)
| Campo | Tipo |
|-------|------|
| baseId | int FK |
| sectorId | int FK |

### tickets
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| usuarioId | string FK | Quién lo creó |
| baseId | int FK | Base del problema |
| sectorId | int FK | Sector destino |
| asunto | string | Asunto del ticket |
| descripcion | string | Descripción |
| estado | enum | abierto / en_proceso / cerrado |
| prioridad | enum | baja / media / alta |
| historial | JSON | Acciones y timestamps |

### conversaciones (historial del bot)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| userTelefono | string FK | Teléfono del usuario |
| ticketId | int FK null | Ticket asociado (se setea al crearlo) |
| mensaje | string | Texto del mensaje |
| direccion | enum | inbound / outbound |
| metadata | JSONB null | Datos extra |
| createdAt | timestamp | Cuándo |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Base de datos | PostgreSQL + Sequelize |
| Bot WhatsApp | whatsapp-web.js + Puppeteer (WhatsApp Web, no oficial) |
| Tiempo real | Socket.IO |
| Exposición segura | Cloudflare Tunnel (cloudflared) |
| Contenedores | Docker & Docker Compose |

### Simulación de comportamiento humano (anti-detección)

| Mecanismo | Implementación |
|---|---|
| **Typing indicator** | Inyección directa vía `client.pupPage.evaluate()` con `WAWebChatStateBridge.sendChatStateComposing()` (no usa `sendStateTyping()` que falla con error CDP). Delay proporcional: `1500 + texto.length * 15 + random(0-2000)` ms |
| **Rate limit** | Máximo 1 mensaje saliente cada 2 segundos por usuario (`enviar.ts`) |
| **Cola FIFO** | Mensajes inbound procesados secuencialmente por usuario (`Map<tel, Promise>`) |
| **Botones** | Texto con emojis numerados + `parsearBotonNumerico()` + `_lastButtons`. Los `Buttons`/`List` nativos de whatsapp-web.js están deprecados por WhatsApp y no funcionan. |
| **Read receipts** | `chat.sendSeen()` antes de procesar cada mensaje |
| **Historial trazable** | Mensajes inbound/outbound persisten en `conversaciones`. Al crear un ticket, se asocian automáticamente los mensajes recientes con `ticketId`. |
| **Formato chatId** | Soporte para `@c.us` y `@lid` (Linked Devices), caché en memoria |

---

## Estructura del proyecto

```
bot-dgcatra/
├── .opencode/
│   └── tasks.md               # Seguimiento de tareas
├── cliente/                   # Frontend React (Vite + TypeScript)
│   ├── src/
│   │   ├── api/client.ts      # Fetch wrapper con JWT
│   │   ├── context/AuthContext.tsx  # Login (teléfono → código → token)
│   │   ├── context/useSocket.ts     # Socket.IO hook para real-time
│   │   ├── layouts/DashboardLayout.tsx  # Sidebar + header
│   │   └── pages/                   # Dashboard, login, tickets, admin CRUD
│   ├── package.json
│   ├── vite.config.ts
│   └── .env
├── servidor/
│   ├── src/
│   │   ├── api/index.ts       # Express entry point + Socket.IO
│   │   ├── bot/               # Lógica del bot WhatsApp (whatsapp-web.js)
│   │   ├── config/            # Config centralizado + DB connection
│   │   ├── controllers/       # CRUD auth, bases, sectores, usuarios, tickets, stats
│   │   ├── middleware/         # JWT + admin middleware
│   │   ├── models/            # Modelos Sequelize (Base, Sector, BaseSector, User, Ticket, Conversacion)
│   │   ├── routes/            # Rutas Express
│   │   └── socket/server.ts   # Socket.IO server
│   ├── Dockerfile
│   ├── docker-compose.yml     # api + db
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .gitignore
└── README.md
```

---

## Flujo de registro (bot)

1. Usuario envía "hola" al bot
2. Bot pide **código de acceso de la base** (`PIE2026` / `ONC2026`)
3. Muestra los **sectores** de esa base (Operativo, Administrativo, Soporte Técnico)
4. Si elige **Soporte Técnico** → pide código de admin (`admin2024`) → será admin
5. Si elige otro sector → usuario normal
6. Nombre completo → confirmar → ✅

**Un solo código para todos. Los de Soporte Técnico ponen uno extra.**

## Flujo de creación de ticket (bot)

1. Usuario escribe "ticket" o presiona el botón "🎫 Nuevo ticket"
2. Bot pide **descripción del problema**
3. Bot pide **ubicación** (dónde ocurre)
4. Bot muestra resumen y pide confirmación
5. Confirmado → se crea el ticket con estado `abierto` y el usuario recibe el número de ticket
6. El ticket aparece en el dashboard para que un admin lo adopte

## Tipos de usuarios

| Tipo | Qué puede hacer |
|------|----------------|
| **Usuario** | Crear tickets por WhatsApp, ver sus tickets con `/mis-tickets` |
| **Admin** | Todo lo anterior + dashboard, adoptar/cerrar tickets, gestionar bases/sectores/usuarios |
| **Super Admin** | Mismo que admin + se asigna automáticamente al registrarse si coincide con `SUPER_ADMIN_PHONE` |

## Frontend (cliente/)

Dashboard React con autenticación JWT.

| Ruta | Componente | Descripción |
|------|-----------|------------|
| `/login` | `LoginPage` | Login: teléfono → OTP por WhatsApp (backup: código maestro) |
| `/` | `DashboardHome` | Panel principal |
| `/tickets` | `TicketsList` | Lista de tickets con filtros (estado, prioridad) |
| `/tickets/:id` | `TicketDetail` | Detalle del ticket + adoptar/cerrar + historial |

---

## Variables de entorno (servidor/.env)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (4002) |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT (24h expiración) |
| `SUPER_ADMIN_PHONE` | Teléfono del super admin (se registra automáticamente como admin) |
| `MASTER_CODE` | Código maestro de acceso al dashboard (backup si no llega el OTP) |

---

## Login al dashboard

1. Usuario ingresa teléfono (sin 15, sin 0: `1166086509`)
2. Backend normaliza (`5491166086509`), busca en DB, genera código de 6 dígitos
3. **Envía el código por WhatsApp** al usuario vía el bot
4. Código expira en 5 minutos. Como backup, se puede usar `MASTER_CODE`
5. JWT expira en 24h. Auto-logout si 30 min de inactividad

---

## Mapa de rutas (API)

### Auth (público — rate limited: 5 intentos / 5 min)
| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/solicitar-codigo | Envía código de 6 dígitos por WhatsApp al usuario |
| POST | /api/auth/verificar-codigo | Verifica código (o MASTER_CODE) y devuelve JWT |

### Dashboard (requiere JWT via `Authorization: Bearer <token>`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/bases | Listar bases |
| POST | /api/bases | Crear base |
| PATCH | /api/bases/:id | Actualizar base |
| DELETE | /api/bases/:id | Eliminar base | ✅ Admin |
| GET | /api/sectores | Listar sectores |
| GET | /api/sectores/:id | Obtener sector |
| GET | /api/sectores/base/:baseId | Sectores de una base |
| POST | /api/sectores | Crear sector | ✅ Admin |
| PATCH | /api/sectores/:id | Actualizar sector | ✅ Admin |
| DELETE | /api/sectores/:id | Eliminar sector | ✅ Admin |
| POST | /api/sectores/asignar | Asignar sector a base | ✅ Admin |
| DELETE | /api/sectores/base/:baseId/sector/:sectorId | Remover sector de base | ✅ Admin |
| GET | /api/usuarios | Listar usuarios |
| GET | /api/usuarios/:telefono | Obtener usuario por teléfono |
| PATCH | /api/usuarios/:telefono | Actualizar usuario (solo admin puede cambiar `esAdmin`) |
| GET | /api/tickets | Listar tickets (filtros: estado, prioridad, baseId, sectorId) |
| GET | /api/tickets/:id | Detalle del ticket (incluye historial) |
| POST | /api/tickets | Crear ticket (asunto, descripcion, ubicacion, baseId) |
| PATCH | /api/tickets/:id | Actualizar ticket (estado, prioridad, técnico, solución) | ✅ Admin |
| GET | /api/stats/resumen | Totales (abiertos, cerrados, en_proceso, alta prioridad, usuarios) |
| GET | /api/stats/por-base | Tickets agrupados por base |
| GET | /api/stats/por-mes | Tickets agrupados por mes |
| GET | /api/stats/top-usuarios | Usuarios con más tickets |

---

## Tunnel (Cloudflare)

El tunnel corre como servicio del **host** (`systemctl status cloudflared`), no dentro de Docker. Usa **config remota** manejada desde el dashboard de Cloudflare Zero Trust.

Reglas ingress actuales:

| Hostname | Servicio local |
|---|---|
| `dgcatra.alejndrogcandia.online` | `http://localhost:4002` |

---

## Inicio rápido (desarrollo local)

```bash
# 1. Instalar dependencias
cd servidor && npm install
cd ../cliente && npm install

# 2. Configurar variables de entorno
cp servidor/.env.example servidor/.env
# Editar .env con las credenciales

# 3. Levantar servicios
cd servidor && docker compose up -d

# 4. Seed de datos iniciales
cd servidor && npm run seed

# 5. Iniciar backend
cd servidor && npm run dev

# 6. Iniciar frontend
cd cliente && npm run dev
```

---

## Deploy (Docker)

```bash
cd servidor
docker compose up --build -d
```
