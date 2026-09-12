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
- ▶️ **#1 (tests de integración)** — pendiente, se hará en pasada aparte.

### Pendiente detectado (no implementado)
- [ ] **`sync({alter:true})` recrea constraints UNIQUE duplicados en cada rebuild.** Evidencia: `usuarios.email` llegó a tener 6 (`key`, `key1`…`key5`) y `bases.nombre` 3. Inofensivo pero se acumula. Opciones: (a) declarar los índices con nombre fijo en los modelos, (b) migraciones controladas (#3).
