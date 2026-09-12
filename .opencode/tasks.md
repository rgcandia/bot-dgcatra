# Plan de implementación — bot-dgcatra

> Decisiones confirmadas con el usuario (2026-09-12). Simplificado: no hay "usuarios registrados" (solo admins).

## Decisiones confirmadas
1. **Sin registro previo / sin usuarios registrados**: el único "registrado" es el admin. Todo el que escribe al bot es anónimo hasta que genera un reclamo.
2. **Flujo de pre-registro de nombre completo**: la primera vez que un número desconocido escribe, se le da la bienvenida y se le pide su nombre completo de forma interactiva. A partir de la segunda vez, no se le vuelve a pedir el nombre.
3. **Flujo de ticket ÚNICO para todos**:
   descripción → **base (lista numerada, SIEMPRE)** → ubicación específica → confirmación (con nombre + base + ubicación) → crea ticket.
4. **Alta manual de admins**: desde **Usuarios** (solo super admin), nombre + teléfono → WhatsApp pide **"confirmar"/"sí"** o **"confirmar"** → el bot detecta y confirma la cuenta → desde ahí recibe OTP y loguea.
5. **Permisos**: admin manual = solo tickets (`esAdmin=true`, `superAdmin=false`). Solo super admin ve config. Ya funciona así (sin cambios).
6. **Teléfono canónico**: `54911XXXXXXXX`.

---

## Tareas Completadas

### 2026-09-12 — Restructuración General completada
- [x] **Fase 0 — Utilidad de Teléfono**: Creado `servidor/src/utils/telefono.ts` con normalización robusta de números de Argentina. Creado `servidor/src/__tests__/telefono.test.ts` con tests unitarios exitosos.
- [x] **Fase 1 — Flujo de Ticket Único y Pre-registro de Nombre**:
  - Eliminado el muro de registro general (`servidor/src/bot/handlers/registro.ts` eliminado por completo).
  - Modificado `servidor/src/bot/index.ts` para solicitar nombre completo la primera vez que interactúan, guardarlo en `User` y habilitar el menú de opciones.
  - Reescrito `servidor/src/bot/handlers/ticket.ts` para seguir el nuevo flujo de: Descripción -> Selección de Base de Lista Numerada -> Ubicación Específica -> Confirmación.
  - Actualizados `servidor/src/bot/schemas.ts` y tests unitarios de validación en `servidor/src/__tests__/schemas.test.ts`.
- [x] **Fase 2 — Alta Manual de Admins y Confirmación**:
  - Agregada columna `confirmadoWhatsApp` en modelo `User.ts` (con `defaultValue: true` para no bloquear usuarios existentes).
  - Implementado endpoint `POST /api/usuarios` en `usuarios.controller.ts` para que el Super Admin registre administradores enviando un WhatsApp automático de activación.
  - Implementada lógica de verificación de activación en el router principal del bot (`servidor/src/bot/index.ts`). Si un admin no confirmado escribe, el bot le solicita responder "confirmar".
  - Protegido el login en `auth.controller.ts` para impedir que admins no confirmados soliciten OTP.
  - Creado modal de "Nuevo Administrador" e integración con la API en el frontend (`cliente/src/pages/admin/UsuariosPage.tsx`).
- [x] **Fase 3 — Verificación de Compilación**:
  - Verificada la correcta compilación de TypeScript y empaquetado tanto del servidor (`npm run build` en backend exitoso) como del dashboard de React (`npm run build` en frontend exitoso).

### 2026-09-12 — #4: `tecnicoAsignado` migrado a FK por teléfono
- [x] **Modelo** (`Ticket.ts`): nueva columna `tecnicoTelefono` (FK lógica a `usuarios.telefono`) + asociación `Ticket.belongsTo(User, as:'tecnico', constraints:false)`. `tecnicoAsignado` queda como nombre denormalizado para mostrar/ordenar/buscar.
- [x] **Controller** (`tickets.controller.ts`): `getAll` acepta `?tecnicoTelefono=` y `?sinAsignar=true` (ahora filtra por teléfono); include del técnico. `update()` recibe `tecnicoTelefono`, valida que exista y sea admin, resuelve el nombre, y compara permisos por **teléfono** (`req.user.telefono`) en vez de por nombre. Se mantiene compat con `tecnicoAsignado` (legacy por nombre).
- [x] **Front**: `TicketDetail` dropdowns con `value=t.id` (teléfono) y label con sufijo del teléfono cuando hay nombres repetidos; "Adoptar caso"/"Derivar"/"Dejar caso" por teléfono. `TicketsList` "solo míos" → `?tecnicoTelefono=`. `useSocket` notifica asignación comparando por teléfono.
- [x] **seed-demo**: setea `tecnicoAsignado` + `tecnicoTelefono`.
- [x] **Verificación**: `tsc` backend OK, `tsc` front OK, 46 tests OK, build front OK, rebuild Docker OK, `/health` 200, bot conectado (5491126259181).
- [x] **E2E** (con 2 técnicos del MISMO nombre "Juan Perez" y distinto teléfono): PATCH asignar por teléfono → 200 con `tecnicoTelefono`/`tecnicoAsignado`/`tecnico` correctos; `?tecnicoTelefono=` → 1; `?sinAsignar=true` → 0; técnico inexistente → 400; usuario no-admin → 400; dejar caso + reabrir → 200. Datos de prueba eliminados.
- [x] **Limpieza DB**: eliminados índices UNIQUE duplicados que acumula `sync({alter:true})` en `bases.nombre` (key1, key2) y `usuarios.email` (key1..key5).

### Decisiones 2026-09-12 (alcance)
- ⏸️ **#2 (CI/CD / GitHub Actions)** — pospuesto.
- ⏸️ **#3 (migraciones controladas en vez de `sync({alter:true})`)** — pospuesto.
- ✅ **#1 (tests de integración)** — implementado el 2026-09-12 (ver abajo).
### Pendiente detectado (no implementado)
- [ ] **`sync({alter:true})` recrea constraints UNIQUE duplicados en cada rebuild.** Evidencia: `usuarios.email` llegó a tener 6 (`key`, `key1`…`key5`) y `bases.nombre` 3. Inofensivo pero se acumula. Opciones: (a) declarar los índices con nombre fijo en los modelos, (b) migraciones controladas (#3).

### 2026-09-12 — Fix: índices UNIQUE duplicados por `sync({alter:true})`
- [x] `Base.nombre` y `User.email`: quitado `unique: true` del campo y declarado índice con **nombre fijo** (`bases_nombre_unique`, `usuarios_email_unique`) en las opciones del modelo.
- [x] Verificado con 2 arranques consecutivos del contenedor: no se crean constraints UNIQUE nuevos (idempotente). Unicidad intacta.
- [x] `tsc` OK + rebuild Docker + `/health` 200.

### 2026-09-12 — #1: Tests de integración (API + Postgres de test)
- [x] **App testeable** (`src/api/app.ts`): extraída `createApp()` con middlewares + rutas, **sin** efectos colaterales (no escucha el puerto, no sincroniza la DB, no inicializa WhatsApp). `src/api/index.ts` quedó como "bootstrap" (dotenv, socket.io, sync, listen, graceful shutdown). El request-logger se omite cuando `NODE_ENV=test`.
- [x] **Infra de tests**: `vitest.config.ts` (unitarios) y `vitest.integration.config.ts` (integración, `fileParallelism: false`). Se agregó `supertest` + `@types/supertest` como devDependency. Scripts: `npm test` / `npm run test:unit` y `npm run test:integration`.
- [x] **Fix colateral**: `vitest.config.ts` excluye `dist/`, así `npm test` ya no corre los tests duplicados compilados (antes 6 archivos / 46 tests, ahora 3 / 23 reales).
- [x] **DB de test** (`src/__tests__/integration/setup.ts`): usa `TEST_DATABASE_URL` o `DATABASE_URL` con sufijo `_test`; crea la base si no existe, hace `sync({ force: true })` y **aborta si el nombre no termina en `_test`** (nunca puede tocar la base real). Sin publicar el puerto 5432 del host (ya lo usa otro proyecto): se corre desde el contenedor o con la IP de `dgcatra-db`.
- [x] **Mocks**: se mockea solo `bot/enviar.js` (nada de puppeteer/WhatsApp en tests); el estado del bot se controla con `setBotConnected()` / `setBotDisconnected()`. Cada test usa su propia `X-Forwarded-For` para aislar los rate limiters.
- [x] **Casos cubiertos (55 tests, 4 archivos)**:
  - `auth.test.ts` (19): OTP enviado de 6 dígitos, un solo uso, código inválido/expirado, código maestro (superAdmin), sin teléfono, usuario inexistente, usuario desactivado (403), admin sin confirmar WhatsApp (403), fallo de envío (503 + código descartado), bot desconectado (503), soft-delete, token inválido y token de usuario dado de baja (401).
  - `tickets.test.ts` (18): creación (201 con estado/prioridad/usuario/base), validación de campos, 401 sin token, 403 de no-admin, asignación por teléfono, **2 técnicos homónimos** (asignación y filtro por `tecnicoTelefono` no se pisan), técnico inválido (400), no-admin como técnico (400), reasignación por admin común (403), auto-asignación (200), dejar caso (desasigna + reabre), prioridad solo superAdmin, compat `tecnicoAsignado`, cierre con solución, filtro `sinAsignar`.
  - `usuarios.test.ts` (15): soft-delete (activo/registroCompleto/esAdmin en false, nombre conservado), tickets e historial conservados, bloqueo de OTP y de token viejo, re-registro, 404, filtros activos/inactivos, alta de admin solo superAdmin (403/201 + confirmadoWhatsApp=false), login bloqueado hasta confirmar, 409 de usuario existente, `forzarPromocion`, teléfono inválido, PATCH de admin.
  - `rate-limit.test.ts` (3): 10 intentos de verificación → 429 en el 11º, 5 solicitudes de código → 429 en la 6ª, y aislamiento por IP.
- [x] **Verificación**: `npx tsc --noEmit` OK; `npm test` 3 archivos / 23 tests OK; `npm run test:integration` 4 archivos / 55 tests OK (contra `dgcatra_test`).
- [x] **README**: nueva sección "Tests" con los comandos, la cobertura y las dos formas de apuntar al Postgres de test.

### 2026-09-12 — Fix: identidad de WhatsApp (LID vs. teléfono)
**Problema detectado**: al registrarse, el bot guardó `30262373163147` (un **LID**, `30262373163147@lid`) como si fuera el teléfono. Verificado en vivo: `normalizarTelefonoAR('30262373163147') → null`, y `POST /api/usuarios` con ese id → **400 "Formato de teléfono inválido para Argentina"** (no se podía promocionar a admin al usuario que realmente escribe al bot). Si en cambio se cargaba el teléfono real, se creaba **una fila duplicada** y el bloque de confirmación (`bot/index.ts`) nunca se ejecutaba sobre el LID → el admin quedaba con `confirmadoWhatsApp=false` y **no podía loguearse nunca**.

**Causa**: `procesarMensaje` hacía `msg.from.split('@')[0]` sin distinguir si el id era un teléfono (PN) o un LID.

- [x] **`src/bot/identidad.ts`** (nuevo): `resolverIdentidad(rawFrom)` → si termina en `@lid`, traduce con `client.getContactLidAndPhone([lid])` (API de whatsapp-web.js v1.34) y devuelve `{ telefono, chatId, resuelto }`; normaliza al formato canónico. **Fallback** al LID si el pn viene vacío, si el cliente falla o si no hay cliente → el flujo nunca se rompe. Caché lid→teléfono (solo éxitos, los fallos se reintentan).
- [x] **`src/bot/migrar-lid.ts`** (nuevo): `migrarUsuarioDeLid(lid, telefono)` consolida en transacción las filas viejas guardadas con LID: crea/reutiliza la fila del teléfono real, **conserva el `chatId`** (@lid, el único que sirve para responder), mueve `tickets.userTelefono`, `tickets.tecnicoTelefono` y `conversaciones.userTelefono`, y borra la fila vieja. Idempotente (set de LIDs ya revisados + re-chequeo por proceso).
- [x] **`src/bot/index.ts`**: `procesarMensaje` usa `resolverIdentidad(rawFrom)` para la identidad (`telefono`) y sigue registrando `chatId` con el id crudo; si el LID se resolvió, intenta la consolidación antes de crear el ticket/registrar historial. Se eliminó el `limpiarNumero` local (ahora vive en `identidad.ts`).
- [x] **`src/bot/enviar.ts`**: nuevo `obtenerCliente()` para que la resolución use el cliente ya inicializado.
- [x] **Tests**: `src/__tests__/identidad.test.ts` (9 unitarios: @c.us no consulta, LID→teléfono, normalización, caché, pn vacío, excepción, sin cliente, fallo no cacheado) y `src/__tests__/integration/lid.test.ts` (6: consolidación con y sin fila destino, tickets donde el LID era técnico, sin fila propia, ids iguales, idempotencia).
- [x] **Verificación**: `tsc` OK; unitarios **4 archivos / 32 tests**; integración **5 archivos / 61 tests**; rebuild Docker + `/health` 200 + bot conectado.
- [x] **README**: nueva sección "0. Identidad de WhatsApp: LID vs. teléfono" con la tabla PN/LID, cómo se resuelve y la consolidación automática.
- [ ] **Pendiente de confirmar en producción**: cuando el usuario escriba al bot después del deploy, verificar en logs (`Identidad LID resuelta a teléfono`) y en la DB que su fila pasó al teléfono real. Después ya se puede dar de alta como admin con ese teléfono.


### 2026-09-12 — Fix UI: loader y anti doble-submit al crear admin / enviar código
**Problema detectado**: al dar de alta un admin (modal "Nuevo administrador" de `UsuariosPage.tsx`), el botón "Enviar invitación" no tenía loader ni se deshabilitaba: si el usuario lo apretaba varias veces se enviaban varias invitaciones por WhatsApp (y, si el número ya existía, se repetía el mensaje/la promoción). En el login (`LoginPage.tsx`), el botón "Ingresar" sólo cambiaba el texto (sin spinner) y el doble click podía disparar envíos/verificaciones duplicadas de OTP.

- [x] **`cliente/src/pages/admin/UsuariosPage.tsx`**: nuevo estado `savingAdmin` + guard sincrónico `savingAdminRef`. `handleAddAdmin` ignora llamadas concurrentes, hace `finally` para siempre liberar el guard, y muestra spinner + `disabled` en **"Enviar invitación"** y en **"Sí, promover y verificar"** (cubre tanto alta nueva como promoción de un número ya registrado). "Cancelar" y el click en el overlay del modal quedan bloqueados mientras se envía.
- [x] **`cliente/src/pages/LoginPage.tsx`**: nuevos estados/refs `verifying`/`verifyingRef` (y `sendingRef`). "Enviar código"/"Reenviar" y el submit "Ingresar" (OTP y código maestro) usan guard sincrónico anti doble click; el botón "Ingresar" ahora muestra spinner (`Verificando...`) y "Volver" se deshabilita durante la verificación. Se dejó de depender del `loading` global del `AuthContext` para el botón de verificación.
- [x] **Verificación**: `npx tsc --noEmit` OK y `npm run build` (frontend) OK.
- [ ] **Pendiente** (opcional, no solicitado): idempotencia del lado del backend para POST `/api/usuarios` y `/api/auth/solicitar-codigo` (el front ya evita el doble click, el backend todavía no).

### 2026-09-12 — Fix backend: idempotencia anti-duplicados (OTP e invitación de admin)
**Problema**: el front ya bloqueaba el doble click, pero el backend no. Dos requests concurrentes (varias pestañas, reintentos, un cliente distinto del dashboard) podían generar **dos OTP** o **dos invitaciones por WhatsApp**. Además el POST de alta de admin no tenía ninguna protección de reenvío.

- [x] **`servidor/src/utils/cooldown.ts`** (nuevo): cooldown en memoria por clave (teléfono) con `enCooldown(clave, ms)` → `{ activo, restanteSeg }`, `marcarEnviado(clave, ms)` y `limpiarCooldowns()` (para tests). Limpieza perezosa del `Map` para que no crezca sin límite.
- [x] **`servidor/src/controllers/auth.controller.ts`**: `POST /api/auth/solicitar-codigo` con `OTP_REENVIO_COOLDOWN = 30s`. Si ya se envió un OTP a ese teléfono hace menos de 30 s, responde **429** (`"Ya te enviamos un código hace instantes. Esperá Ns..."`) y **no** manda otro WhatsApp. El cooldown se marca **solo si el envío fue exitoso** (si el envío falla se puede reintentar) y se evalúa después de las validaciones (404/403 no lo consumen).
- [x] **`servidor/src/controllers/usuarios.controller.ts`**: `POST /api/usuarios` con `INVITACION_COOLDOWN = 30s`. Si ya se invitó a ese número hace poco, la respuesta sigue siendo **201** (el alta ya se hizo) pero **no se reenvía** la invitación; se loguea `Invitación de admin no reenviada (cooldown anti-duplicado)`. Cubre tanto el alta nueva como la promoción con `forzarPromocion`.
- [x] **Tests**:
  - `integration/auth.test.ts` (+3): segundo pedido inmediato → 429 y **un solo** WhatsApp enviado; el cooldown es por teléfono (otro número sí puede); el OTP del primer envío sigue siendo válido tras el intento bloqueado.
  - `integration/usuarios.test.ts` (+2): crear dos veces seguidas el mismo número → 409 y **una sola** invitación; promover dos veces con `forzarPromocion` → segunda sin reenvío.
  - `integration/rate-limit.test.ts`: los pedidos de código del test de limiter por IP ahora usan **un teléfono distinto por intento** (antes el mismo), para que el limiter por IP quede aislado del cooldown por teléfono.
  - `integration/setup.ts`: `limpiarTablas()` ahora también ejecuta `limpiarCooldowns()`, porque el cooldown vive en memoria del proceso y no en la DB.
- [x] **Documentación**: README — nota de "Anti duplicados" en *Alta Manual de Administradores*, cooldown documentado en la tabla de `/api/auth/solicitar-codigo` y en la tabla de cobertura de tests.
- [x] **Verificación**: `npx tsc --noEmit` OK; `npm run build` (servidor) OK; unitarios **4 archivos / 32 tests**; integración **5 archivos / 66 tests** (antes 61).
- [x] **Commit + push** y **rebuild del server** (Docker).

### 2026-09-12 — Fix UI: loader y anti doble-submit (frontend)
- [x] `cliente/src/pages/admin/UsuariosPage.tsx`: `savingAdmin` + `savingAdminRef`; spinner/`disabled` en "Enviar invitación" y "Sí, promover y verificar"; se bloquea Cancelar y el click en el overlay mientras se envía.
- [x] `cliente/src/pages/LoginPage.tsx`: `sendingRef`/`verifyingRef` + estado `verifying`; spinner en "Ingresar" (OTP y código maestro); "Volver" deshabilitado al verificar. Se dejó de depender del `loading` global del `AuthContext`.
- [x] Verificación: `npx tsc --noEmit` OK y `npm run build` (frontend) OK.
