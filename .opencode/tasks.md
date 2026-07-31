# Tareas - bot-dgcatra

## En progreso

### 2026-07-31 — Restructuración del bot: botones nativos, typing humano, historial

> **Diagnóstico:** Al migrar de Meta API a whatsapp-web.js, el bot quedó con código legacy que simula botones mandando múltiples mensajes con `👉`, no usa la clase `Buttons` nativa de la librería, la simulación de typing está en código muerto (nunca se ejecuta), y el modelo `Conversacion` nunca persiste historial. Además hay 3-5 queries SQL redundantes por cada mensaje recibido.

#### Problemas detectados
- [ ] **3-5 queries User.findByPk por mensaje** — se busca el mismo usuario repetidas veces en `procesarMensaje`, `manejarUsuarioRegistrado`, `manejarRegistro`, y cada paso del registro
- [ ] **Button detection rota** — `msg._data?.interactiveAnnouncement?.nativeFlow...` es formato Meta API; los `Buttons` nativos responden en `msg.selectedButtonId`
- [ ] **enviarBotones spam** — manda 1 texto + N mensajes `👉` separados. Detectable por anti-bot de WhatsApp
- [ ] **Typing simulado muerto** — `msg.reply` override en `whatsapp.ts:47-54` nunca se invoca; todas las respuestas van por `client.sendMessage`
- [ ] **Historial de conversación no se persiste** — tabla `conversaciones` y modelo `Conversacion` existen pero nunca se escribe ningún registro
- [ ] **User.upsert + race condition** — en `procesarMensaje` se hace upsert y luego se lee inmediatamente, posible estado inconsistente
- [ ] **Sin timeout de sesión** — si el usuario abandona el flujo de registro/ticket, el context queda sucio indefinidamente

#### Plan de restructura

| Nuevo archivo | Responsabilidad |
|---|---|
| `src/bot/whatsapp.ts` | Solo init del cliente + eventos |
| `src/bot/index.ts` | Router ligero, 1 sola query al usuario |
| `src/bot/session.ts` | Caché en memoria + fetch único de User + guardado de historial |
| `src/bot/enviar.ts` | Envío unificado con typing real (`sendStateTyping` + delays aleatorios) + `Buttons`/`List` nativos |
| `src/bot/handlers/registro.ts` | Flujo de registro con botones nativos (max 3) + soporte texto numérico |
| `src/bot/handlers/ticket.ts` | Flujo de creación de ticket con botones nativos |
| `src/bot/handlers/comandos.ts` | Comandos de usuario registrado (ayuda, mis-tickets) |
| `src/bot/historial.ts` | Guarda cada mensaje inbound/outbound en `Conversacion` |

#### Checklist de implementación
- [x] **Fix chatId**: `limpiarNumero` soporta `@lid`, caché de chatId en `enviar.ts` (26-07-31)
- [x] **Session.ts**: único punto de acceso a User, caché LRU en memoria, guarda historial
- [x] **Historial.ts**: persistir cada mensaje inbound/outbound en `conversaciones` (fire-and-forget)
- [x] **Enviar.ts nativo**: `Buttons` y `List` reales, `sendStateTyping` + delays 1.5-4s aleatorios
- [x] **Handlers/**: separados en `handlers/registro.ts`, `ticket.ts`, `comandos.ts`
- [x] **Index.ts**: router delgado que solo despacha al handler correcto (1 sola query a User)
- [x] **Whatsapp.ts**: limpiado código muerto del typing viejo
- [ ] **Timeout de sesión**: limpiar context después de 15 min de inactividad
- [x] **Build + deploy**: compilado, copiado a contenedor, reconectado sin QR
- [x] **Docker**: volumen `.wwebjs_auth` bind mount para persistir sesión, `shm_size: 2gb`, `dns`, rotación logs, fix `Singleton*`
- [x] **Cola por usuario**: `Map` en memoria, mensajes del mismo usuario se procesan en orden FIFO
- [x] **sendSeen()**: marcar como leído antes de responder (comportamiento humano natural)

---

## Pendiente

### Frontend
- [ ] CRUD de bases/sectores/usuarios en frontend
- [ ] Socket.IO en frontend para tiempo real (socket.io-client)
- [ ] Deploy del frontend en Vercel
- [ ] Integrar Groq IA para conversación natural

---

## En progreso / Completado

### 2026-07-29 — Migración: Meta API → whatsapp-web.js

> **Motivo:** La API oficial de Meta requiere registrar una empresa, verificar negocio, configurar webhook, tokens de acceso y números de teléfono business. Es un proceso burocrático y lento. Para un bot interno de tickets (bajo volumen, uso exclusivo de empleados), optamos por `whatsapp-web.js` que se conecta vía WhatsApp Web escaneando un QR, sin necesidad de Meta Business API.

#### Completado
- [x] **Dependencias**: agregadas `whatsapp-web.js`, `qrcode-terminal`, `puppeteer`
- [x] **Dockerfile**: instalado Chromium + librerías, creado `/app/session` para sesión persistente
- [x] **Cliente WhatsApp**: `src/bot/whatsapp.ts` con LocalAuth, QR en terminal, eventos
- [x] **Reemplazar enviar.ts**: Meta API → `client.sendMessage()` con simulación de escritura
- [x] **Eliminar Meta Webhook**: removidas rutas `GET/POST /webhook/meta` de api/index.ts
- [x] **Eliminar BullMQ + Workers**: removidos queue/, workers/, configuración Redis
- [x] **Auth OTP**: Redis → Map en memoria (eliminada dependencia ioredis)
- [x] **Docker Compose**: simplificado a solo API + DB, sin workers/redis
- [x] **Config/Limpieza**: .env.example sin vars Meta, removidos `bullmq` e `ioredis`
- [x] **Build**: TypeScript compila sin errores

### 2026-07-27 — Seguridad, estructura y tickets

#### Backend — Seguridad
- [x] **Fix privilege escalation**: crear `middleware/admin.ts` que verifica `esAdmin`
- [x] **Fix usuarios**: solo admin puede cambiar `esAdmin` en PATCH `/api/usuarios/:telefono`
- [x] **Fix adminMiddleware en rutas sensibles**: bases create/update/delete, sectores create/update/delete/asignar, tickets update
- [x] **Fix rate limiting**: express-rate-limit en `/auth/solicitar-codigo` y `/auth/verificar-codigo` (5 intentos / 5 min)
- [x] **Fix Socket.IO auth**: validación de JWT en handshake con `io.use()`
- [x] **Fix route shadow**: reordenar sectores.routes — `GET /base/:baseId` antes de `GET /:id`
- [x] **Fix Login URL producción**: AuthContext usa `VITE_API_URL` en vez de rutas relativas
- [x] **Fix CSS var inexistente**: `DashboardHome` usaba `var(--accent)` no definido → `var(--primary)`

#### Backend — Tickets
- [x] **POST /api/tickets**: crear ticket desde dashboard o bot
- [x] **Flujo completo creación de ticket por WhatsApp**: 4 pasos con botones (iniciar → describir → ubicación → confirmar)
- [x] **Comando /mis-tickets**: muestra últimos 5 tickets del usuario con estado
- [x] **Historial con autor**: cada cambio registra quién lo hizo

#### Frontend — Tickets
- [x] **Página TicketsList.tsx**: tabla con filtros por estado y prioridad
- [x] **Página TicketDetail.tsx**: detalle con botón "Adoptar caso" (admin) y "Cerrar ticket" (admin con solución)
- [x] **Historial visible**: timeline de cambios con autor y timestamp
- [x] **Badge admin en sidebar**: muestra "Admin" si el usuario es admin
- [x] **Rutas**: `/tickets` (lista), `/tickets/:id` (detalle)

#### Frontend — Instalación
- [x] `express-rate-limit` agregado a servidor

---

## Análisis (2026-07-15)

### Estado general
La arquitectura está bien pensada (API + worker separados, cola BullMQ, Docker), el modelo de datos es sólido, y el README es exhaustivo. Con los cambios del 2026-07-27 se resolvieron los problemas críticos de seguridad y se implementó la funcionalidad core de tickets.

### Lo que está bien
- **Arquitectura:** API y worker separados, webhook encola y retorna 200 — mensajes no se pierden si el worker cae
- **Modelo de datos:** 6 tablas limpias, relaciones correctas (Base↔Sector M:M, User→Base/Sector, Ticket→User/Base/Sector)
- **Config centralizada:** config/index.ts valida env vars al inicio, JWT_SECRET y DATABASE_URL required
- **Auth flow:** Registro guiado por WhatsApp: código base → sector → nombre → email → confirmar. Flujo completo
- **Dockerfile:** Multi-stage build, usuario non-root, sin dev dependencies en producción
- **Frontend:** CSS design system limpio, auth flow funcional, TypeScript estricto
- **Seguridad:** Admin middleware, rate limiting, Socket.IO auth, privilege escalation fixed
- **Tickets:** Creación por WhatsApp, listado en frontend, detalle con adoptar/cerrar

### Lo que falta (para producción)
1. Conectar número de WhatsApp real (Meta API)
2. Enviar OTP por WhatsApp (hoy solo console.log)
3. Frontend: CRUD de bases, sectores, usuarios
4. Deploy frontend en Vercel
5. Socket.IO client en frontend
