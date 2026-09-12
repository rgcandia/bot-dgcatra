# bot-dgcatra

Bot de WhatsApp para la gestión de tickets del sector Sistemas del Cuerpo de Agentes de Tránsito de CABA (GCBA). Presupuesto $0.

---

## Descripción del negocio

Sistema de tickets técnicos interno para el sector Sistemas del Cuerpo de Agentes de Tránsito de CABA. Cualquier agente puede reportar incidencias informáticas vía WhatsApp sin necesidad de registrarse previamente, y el equipo de Sistemas las gestiona desde un dashboard web administrativo.

---

## Modelo de datos

### usuarios
| Campo | Tipo | Descripción |
|-------|------|-------------|
| telefono | PK string | Teléfono del usuario |
| nombreCompleto | string | Nombre y apellido |
| email | string | Email (opcional) |
| esAdmin | boolean | Si puede ver el dashboard (requiere invitación y confirmación) |
| confirmadoWhatsApp | boolean | Si ya confirmó su cuenta de admin vía WhatsApp |
| registroCompleto | boolean | Si cargó su nombre inicialmente |
| pasoRegistro | int | Paso actual del registro temporal |
| context | JSON | Datos temporales del flujo de ticket |

### bases
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| nombre | string | Nombre del establecimiento |
| direccion | string | Dirección |
| tipo | enum | `base` / `playa` / `comuna` (edificios donde trabaja el personal) |

### tickets
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK auto int | |
| usuarioId | string FK | Quién lo creó |
| baseId | int FK | Base del problema (se solicita siempre al crear un ticket) |
| asunto | string | Asunto del ticket |
| descripcion | string | Descripción del problema |
| estado | enum | abierto / en_proceso / cerrado |
| prioridad | enum | baja / media / alta |
| ubicacion | string | Ubicación específica del problema |
| tecnicoTelefono | string FK null | Técnico asignado — FK lógica a `usuarios.telefono` (el teléfono es el id; evita colisiones de nombres) |
| tecnicoAsignado | string null | Nombre del técnico (denormalizado, solo para mostrar/ordenar/buscar) |
| cerradoPor | enum null | `usuario` / `tecnico` — quién cerró el ticket |
| cerradoPorNombre | string null | Nombre de quien lo cerró |
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

---

## Flujo del Bot (Usuarios Generales)

El bot está abierto al público. No requiere registros complejos.

### 0. Identidad de WhatsApp: LID vs. teléfono

WhatsApp maneja **dos identificadores** por cuenta y puede mandar cualquiera de los dos en los mensajes:

| Id | Ejemplo | Qué es |
| --- | --- | --- |
| **PN** (Phone Number) | `5491166086509@c.us` | El teléfono de siempre. |
| **LID** (Linked ID) | `30262373163147@lid` | Id interno nuevo de las cuentas migradas a LID (WhatsApp ya no expone el teléfono). |

El bot **siempre guarda el teléfono como identidad** (`usuarios.telefono`) y usa el LID solo como `chatId`
para poder responder. Si un mensaje llega con `@lid`, se traduce con
`client.getContactLidAndPhone([lid]) → { lid, pn }` (`src/bot/identidad.ts`), se normaliza el resultado al
formato canónico (`54911XXXXXXXX`) y se sigue el flujo normal. Si la resolución falla (pn vacío, error del
cliente), se usa el LID tal como llegó: el flujo nunca se corta.

Esto es lo que permite después **dar de alta al usuario como administrador con su teléfono real** (y que el
"confirmar" que responde por WhatsApp impacte en su misma fila). Usuarios que hayan quedado guardados con el
LID antes de esta corrección se consolidan solos al recibir el primer mensaje
(`src/bot/migrar-lid.ts`: mueve tickets y conversaciones a la fila del teléfono real, sin perder historial).

### 1. Pre-registro de Nombre (Solo la primera vez)
1. El usuario envía cualquier mensaje ("hola", etc.) al bot.
2. Si el número no está en la base de datos con un nombre, el bot le da la bienvenida:
   *"👋 ¡Hola! Bienvenido al Bot de Gestión de Tickets de Sistemas. Para poder ayudarte mejor, por favor ingresá tu nombre y apellido completo para continuar:"*
3. El usuario responde con su nombre. El bot lo guarda en el modelo `User` y muestra el menú inicial con opciones numeradas ordinarias.

### 2. Creación de Ticket (bot)
Una vez guardado el nombre, el flujo es directo y guiado por estados:
1. El usuario inicia escribiendo "crear", "ticket", "problema", o seleccionando la opción `1` en el menú.
2. Bot pide **descripción del problema** (mínimo 5 caracteres).
3. Bot pide **Base / Establecimiento**: Presenta una lista numerada de todas las bases registradas (1. Base Piedras, 2. Base Once, etc.). El usuario selecciona respondiendo con el número de la opción.
4. Bot pide **Ubicación específica**: *"¿En qué oficina, sector o puesto específico de la base ocurre el problema?"*
5. Muestra un resumen con Nombre, Base, Ubicación y Descripción del problema, y pide confirmación respondiendo **SI** o **NO**.
6. Una vez confirmado, la IA (Groq) genera un título corto, se guarda el ticket, se asocia el historial de conversación, y se notifica en tiempo real a los técnicos a través del panel administrativo.

---

## Flujo de Administradores

### 1. Alta Manual de Administradores
* Los administradores no se registran desde el bot. Son dados de alta manualmente desde el Dashboard administrativo en la sección de **Usuarios** (restringido a Super Administrador).
* El Super Admin ingresa el nombre y teléfono del nuevo admin.
* El backend normaliza el teléfono al formato internacional de Argentina (`54911XXXXXXXX`) utilizando un formateador de teléfono robusto.
* El backend crea el registro con `esAdmin: true` y `confirmadoWhatsApp: false`, y envía un mensaje automatizado por WhatsApp al número del nuevo administrador:
  *"👋 Hola [Nombre]. Te registraron como administrador en el sistema de tickets. Respondé **confirmar** a este mensaje para activar tu cuenta..."*

### 2. Confirmación y Login
* El administrador responde **"confirmar"** o escribe un mensaje afirmativo al bot de WhatsApp.
* El bot detecta que es un admin pendiente, activa la cuenta (`confirmadoWhatsApp: true`) y le confirma la habilitación.
* A partir de este momento, el administrador puede seleccionar su número en la pantalla de login del panel, solicitar el código OTP de 6 dígitos (el cual le llega por WhatsApp) e ingresar.
* **Seguridad:** Los administradores que no estén confirmados no podrán recibir códigos OTP ni loguearse.

---

## Comandos del bot (usuario registrado)

| Comando | Acción |
|---------|--------|
| `ticket` / `crear` / `problema` | Crea un ticket nuevo |
| `tickets` / `mis tickets` | Lista los últimos tickets |
| `ticket N` | Consulta el detalle de un ticket |
| `cerrar N` | Cierra un ticket (abierto o en proceso): pregunta cómo se resolvió y guarda la solución |
| `ayuda` | Muestra la lista de comandos |

- Los tipeos cercanos a `ayuda`, `tickets` y `cancelar` se reconocen con fuzzy matching (Levenshtein ≤ 1).

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
| GET | /api/usuarios | Listar usuarios |
| POST | /api/usuarios | Crear administrador manual | ✅ Super Admin |
| GET | /api/usuarios/:telefono | Obtener usuario por teléfono |
| PATCH | /api/usuarios/:telefono | Actualizar usuario (solo admin puede cambiar `esAdmin`) |
| DELETE | /api/usuarios/:telefono | Eliminar usuario (soft-delete: conserva tickets/historial) | ✅ Admin |
| GET | /api/tickets | Listar tickets |
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

## Tests

```bash
cd servidor

# Unitarios (rápidos, sin DB): helpers del bot, schemas y normalización de teléfonos
npm test                # alias: npm run test:unit

# Integración (API Express real vía supertest + Postgres de test)
npm run test:integration
```

Los tests de integración corren contra **una base aparte** (`dgcatra_test`): la crean si no existe
y le hacen `sync({ force: true })` (la vacían). Por seguridad el setup **aborta** si el nombre de la
DB no termina en `_test`, así nunca pueden tocar la base de producción.

| Archivo | Qué cubre |
| --- | --- |
| `src/__tests__/integration/auth.test.ts` | OTP por WhatsApp (envío, un solo uso, expirado/inválido), código maestro, usuario desactivado y soft-delete, token inválido, bloqueo de usuarios dados de baja |
| `src/__tests__/integration/tickets.test.ts` | Creación de tickets, validaciones, asignación de técnico **por teléfono** (2 técnicos homónimos no se pisan), permisos (auto-asignación / reasignación / prioridad), filtros `?tecnicoTelefono=` y `?sinAsignar=true` |
| `src/__tests__/integration/usuarios.test.ts` | Soft-delete (conserva tickets e historial), bloqueo de login y del token viejo, alta de admins por el super admin, confirmación por WhatsApp |
| `src/__tests__/integration/rate-limit.test.ts` | Bloqueo por fuerza bruta (10 intentos de verificación / 5 pedidos de código por ventana) y aislamiento por IP |

### ¿Contra qué Postgres corren?

- **Desde el contenedor `api`** (recomendado: usa el `DATABASE_URL` del `.env`, host `db`):

```bash
cd servidor
docker compose run --rm --no-deps \
  -v "$PWD/src:/app/src" \
  -v "$PWD/vitest.integration.config.ts:/app/vitest.integration.config.ts" \
  api npx vitest run --config vitest.integration.config.ts
```

- **Desde el host**: apuntando a la IP del contenedor `dgcatra-db` (el puerto 5432 del host ya lo
  usa otro proyecto, así que no se publica):

```bash
cd servidor
set -a; . ./.env; set +a
DBIP=$(docker inspect dgcatra-db --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
TEST_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DBIP}:5432/dgcatra_test" \
  npm run test:integration
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
