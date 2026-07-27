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
| estado | enum | abierto / en curso / cerrado |
| prioridad | enum | baja / media / alta |
| historial | JSON | Acciones y timestamps |

### conversaciones (historial del bot)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| telefono | string FK | Quién habló |
| mensaje | string | Texto del mensaje |
| direccion | enum | entrante / saliente |
| createdAt | timestamp | Cuándo |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Base de datos | PostgreSQL + Sequelize |
| Cola de mensajes | Redis + BullMQ |
| Bot WhatsApp | Meta API (WhatsApp Business API) |
| IA | Groq API |
| Tiempo real | Socket.IO |
| Exposición segura | Cloudflare Tunnel (cloudflared) |
| Contenedores | Docker & Docker Compose |

---

## Estructura del proyecto

```
bot-dgcatra/
├── .opencode/
│   ├── instructions.md        # Instrucciones para la IA
│   └── tasks.md               # Seguimiento de tareas
├── cliente/                   # Frontend React (Vite + TypeScript)
│   ├── src/
│   │   ├── api/client.ts      # Fetch wrapper con JWT
│   │   ├── context/AuthContext.tsx  # Login (teléfono → código → token)
│   │   ├── layouts/DashboardLayout.tsx  # Sidebar + header
│   │   ├── pages/             # Dashboard (placeholder)
│   │   └── types/index.ts     # Tipos compartidos
│   ├── package.json
│   ├── vite.config.ts
│   └── .env
├── servidor/
│   ├── src/
│   │   ├── api/index.ts       # Express entry point (webhook + dashboard + Socket.IO)
│   │   ├── config/index.ts    # Config centralizado (env vars)
│   │   ├── controllers/       # CRUD auth, bases, sectores, usuarios, tickets, stats
│   │   ├── middleware/auth.ts # JWT middleware
│   │   ├── models/            # Modelos Sequelize (Base, Sector, BaseSector, User, Ticket, Conversacion)
│   │   ├── routes/            # Rutas Express por recurso
│   │   ├── socket/server.ts   # Inicialización Socket.IO
│   │   ├── workers/           # Workers BullMQ — procesan cola de mensajes
│   │   └── queue/             # BullMQ config
│   ├── Dockerfile
│   ├── docker-compose.yml     # api, workers, redis, db
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .gitignore
└── README.md
```

---

## Flujo de registro (bot)

1. Usuario envía mensaje al bot
2. Bot pide **código de acceso de la base**
3. Si es correcto → muestra los sectores de esa base
4. Usuario elige sector
5. Usuario escribe nombre
6. Usuario escribe email (opcional)
7. Listo → queda como usuario normal (`esAdmin: false`)

**Super admin:** definido en `.env` con `SUPER_ADMIN_PHONE`. Cuando ese teléfono se registra, se le pone `esAdmin: true` automáticamente.

**Admins adicionales:** los asigna un admin existente desde el dashboard.

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
| `/login` | `LoginPage` | Autenticación 2 pasos (teléfono → código) |
| `/` | `DashboardHome` | Panel principal |
| `/tickets` | `TicketsList` | Lista de tickets con filtros (estado, prioridad) |
| `/tickets/:id` | `TicketDetail` | Detalle del ticket + adoptar/cerrar + historial |

---

## Variables de entorno (servidor/.env)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (4002) |
| `REDIS_HOST` / `REDIS_PORT` | Conexión a Redis |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT |
| `SUPER_ADMIN_PHONE` | Teléfono del super admin (se registra automáticamente como admin) |
| `META_APP_ID` | ID de la Meta App |
| `META_APP_SECRET` | App Secret para firma HMAC |
| `META_VERIFY_TOKEN` | Token de verificación del webhook |
| `META_ACCESS_TOKEN` | Token de acceso permanente (WhatsApp) |
| `META_PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp |
| `GROQ_API_KEY` | API Key de Groq (IA) |

---

## Mapa de rutas (API)

### Webhook Meta
| Método | Ruta | Descripción |
|---|---|---|
| GET | /webhook/meta | Verificación del webhook (Meta challenge) |
| POST | /webhook/meta | Webhook entrante de WhatsApp (firma HMAC-SHA256) |

### Auth (público — rate limited: 5 intentos / 5 min)
| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/solicitar-codigo | Solicita código de 6 dígitos |
| POST | /api/auth/verificar-codigo | Verifica código y devuelve JWT |

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
| GET | /api/stats/resumen | Totales (abiertos, cerrados, en curso, alta prioridad, usuarios) |
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
