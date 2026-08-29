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
| **Historial trazable** | Mensajes inbound/outbound persisten en `conversaciones`. Al crear un ticket, se asocian automáticamente los mensajes del flujo actual (desde `_ticketStart`) con `ticketId`. |
| **Formato chatId** | Soporte para `@c.us` y `@lid` (Linked Devices), caché en memoria |
| **IA para títulos** | Groq (`llama-3.1-8b-instant`) genera títulos cortos al crear tickets. El prompt instruye a la IA a NO inventar detalles. Si el mensaje no es un problema técnico, titula `"Consulta general"`. Si la IA falla o no está configurada (`GROQ_API_KEY`), usa las primeras 60 letras de la descripción. |

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
│   │   │   ├── groq.ts         # IA: genera títulos de tickets (Groq API)
│   │   │   ├── handlers/       # Flujos: registro, ticket, comandos
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
2. Bot muestra bienvenida: *"¡Bienvenido! Sistema de Gestión de Tickets DGCATRA"* → escribe **SI** para empezar o **NO** para cancelar (acepta variantes: `sí`, `dale`, `ok`, `cancelar`, `salir`, etc.)
3. Bot pide **código de acceso de la base** (`PIE2026` / `ONC2026`)
4. Muestra los **sectores** con números (①②③). Puede elegir escribiendo el número o el nombre del sector (sin tildes, case-insensitive)
5. Si elige **Soporte Técnico** → pide código de admin (`admin2024`) → será admin
6. Si elige otro sector → usuario normal
7. Nombre completo → confirmación: escribe **SI** o **NO** (sin botones, texto libre)
8. ✅ Registro completo

**Un solo código para todos. Los de Soporte Técnico ponen uno extra.**

## Flujo de creación de ticket (bot)

1. Usuario escribe "ticket", "crear", "problema", "reportar" o elige `1` en el menú
2. Bot: *"¡Dale, creemos un ticket!"* → pide **descripción del problema**
3. Bot pide **ubicación** (dónde ocurre)
4. Bot muestra resumen y pide confirmación (**SI** / **NO** en texto)
5. Confirmado → la IA (Groq) genera un título corto. Si no es un problema técnico, titula `"Consulta general"`. Si la IA falla, usa las primeras 60 letras.
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
| `/tickets` | `TicketsList` | Lista de tickets con filtros (estado, prioridad) y columna Prioridad ordenable |
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
| `GROQ_API_KEY` | API key de Groq para generar títulos de tickets con IA (opcional, sin ella usa fallback) |

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
| GET | /api/usuarios | Listar usuarios (query: `search`, `page`, `limit`, `esAdmin`, `registroIncompleto`, `inactivo`) |
| GET | /api/usuarios/:telefono | Obtener usuario por teléfono |
| PATCH | /api/usuarios/:telefono | Actualizar usuario (solo admin puede cambiar `esAdmin`) |
| DELETE | /api/usuarios/:telefono | Eliminar usuario (soft-delete: conserva tickets/historial) | ✅ Admin |
| GET | /api/tickets | Listar tickets (query: `search`, `page`, `limit`, `estado`, `prioridad`, `baseId`, `sectorId`, `tecnicoAsignado`, `sinAsignar`) |
| GET | /api/tickets/:id | Detalle del ticket (incluye historial) |
| GET | /api/tickets/:id/conversacion | Conversación WhatsApp del ticket |
| POST | /api/tickets | Crear ticket (asunto, descripcion, ubicacion, baseId) |
| PATCH | /api/tickets/:id | Actualizar ticket (estado, prioridad, técnico, solución) | ✅ Admin |
| GET | /api/tickets/:id/chat | Estado del chat takeover |
| POST | /api/tickets/:id/chat/iniciar | Iniciar chat takeover | ✅ Admin |
| POST | /api/tickets/:id/chat/enviar | Enviar mensaje al agente | ✅ Admin |
| POST | /api/tickets/:id/chat/finalizar | Finalizar chat takeover | ✅ Admin |
| GET | /api/stats/resumen | Totales (abiertos, cerrados, en_proceso, alta prioridad, usuarios) |
| GET | /api/stats/por-base | Tickets agrupados por base |
| GET | /api/stats/por-mes | Tickets agrupados por mes |
| GET | /api/stats/top-usuarios | Usuarios con más tickets |
| GET | /api/settings/master-code | Obtener código maestro | ✅ Admin |
| PATCH | /api/settings/master-code | Actualizar código maestro | ✅ Admin |
| POST | /api/settings/logout-whatsapp | Desvincular WhatsApp | ✅ Admin |
| POST | /api/settings/limpiar-db | Limpiar toda la DB (TRUNCATE, IDs reiniciados) | ✅ Admin |

---

## Tunnel (Cloudflare)

El tunnel corre como servicio del **host** (`systemctl status cloudflared`), no dentro de Docker. Usa **config remota** manejada desde el dashboard de Cloudflare Zero Trust.

Reglas ingress actuales:

| Hostname | Servicio local |
|---|---|
| `dgcatra.alejndrogcandia.online` | `http://localhost:4002` |

---

## Deploy Frontend (Vercel)

El frontend se deploya desde el directorio `cliente/`. El `vercel.json` ya está incluido en el repo.

**Variables de entorno en Vercel:**

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://dgcatra.alejndrogcandia.online` |

**En el servidor**, agregar el dominio de Vercel a la variable `FRONTEND_URL` (CORS):

```env
FRONTEND_URL=https://bot-dgcatra.vercel.app
```

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

---

## Últimos cambios (2026-08-29)

- **Soft-delete de usuarios**: eliminar un usuario ya no borra sus tickets ni su historial (antes el `CASCADE` de las FKs los borraba). Ahora se hace un *soft-delete*: resetea el registro (`registroCompleto=false`, `activo=false`, `esAdmin=false`) y el usuario puede volver a registrarse con "hola".
- **Bloquear acceso (activo)**: el campo `activo` controla el acceso. Desactivado → el bot lo ignora y no puede entrar al dashboard; se puede reactivar desde el panel.
- **Se elimina la blacklist en memoria**: la validación de sesión ahora consulta la DB (`activo`), con bypass para el código maestro. Corrige el bug de login que cerraba la sesión de un usuario re-registrado.
- **`trust proxy = 1`**: el rate-limit ahora usa la IP real del cliente (Cloudflare Tunnel), evitando buckets globales y el error `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
- **Lista de usuarios**: por defecto muestra solo usuarios activos; los inactivos aparecen con el filtro "Inactivos".

## Últimos cambios (2026-08-28)

- **Sesión del dashboard de 24h**: se eliminó el auto-logout por inactividad de 30 min (`INACTIVITY_TIMEOUT` = 24h, alineado con la expiración del JWT). Cualquier 401 redirige a `/login`.
- **Socket.IO CORS**: incluye `FRONTEND_URL` (frontend de Vercel).
- **Seguridad**: cierre de escalado de privilegios — `sectores.update` no pisa `codigoAdmin`; el registro solo otorga `esAdmin` si se verificó el código del sector.
- **Auth**: `/api/auth/admins` con rate limit; `solicitar-codigo` devuelve 503 si falla el envío del OTP.
- **Chat takeover**: el timeout re-arma cada 30s. Código de base case-insensitive. `enviarLista` guarda el mensaje completo en historial.
