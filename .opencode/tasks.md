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

### 2026-08-04 — Fix typing simulation + rate limit + análisis de colas

> **Diagnóstico inicial:** La simulación de escritura en dgcatra usaba `pupPage.evaluate()` con `WWebJS.sendChatstate` directamente. En norbridge, el delay era fijo (1-3s) y los errores se silenciaban.

> **Primer intento (fallido):** Reemplazar por `getChatById() + sendStateTyping()` — falló porque `getChatById` llama internamente a `WWebJS.getChat(chatId)` SIN `{getAsModel: false}`, y WhatsApp Web devuelve error CDP `"r"` durante la serialización del modelo Chat.

> **Debug:** Se agregaron logs temporales que revelaron el stack trace completo: el error ocurría en `Client.getChatById()` → `pupPage.evaluate()` → `ExecutionContext.evaluate()` → CDP exception details con valor `"r"`.

> **Solución final:** Inyectar el typing directamente en una sola llamada a `pupPage.evaluate()` con callback async, usando los módulos internos de WhatsApp Web (`WAWebChatStateBridge` + `WAWebWidFactory`), sin pasar por `getChatById` ni `sendStateTyping`. Mismo patrón que usa `sendMessage` (que sí funciona).

#### Cambios realizados
- [x] **dgcatra `enviar.ts`**: `simularEscritura` inyecta `sendChatStateComposing` directo vía `pupPage.evaluate(async callback)`. Bye a `getChatById` + `sendStateTyping`.
- [x] **norbridge `whatsapp.ts`**: Delay proporcional a `texto.length * 12`, logs de error, rate limit 2s por usuario.
- [x] **Build + deploy ambos**: compilados y redeployados en Docker.

#### Análisis de colas de mensajes

| Aspecto | dgcatra | norbridge |
|---|---|---|
| **Cola inbound** | `Map<tel, Promise<void>>` FIFO por usuario (`index.ts:7-16`) | Sin cola — usa flag `procesando` con timeout de 2 min |
| **Rate limit outbound** | 1 msg cada 2s por usuario (`enviar.ts`) | 1 msg cada 2s por usuario (`whatsapp.ts`) |
| **Deduplicación** | No | `Set<string>` con TTL 15s |
| **Orden garantizado** | Sí, secuencial por usuario | Parcial |
| **Riesgo detección** | Bajo | Bajo (con rate limit agregado) |

---### 2026-08-04 (2) — Botones nativos + limpieza

- [x] **`enviarBotones()`**: Reemplazado texto con emojis por clase `Buttons` nativa de whatsapp-web.js. Botones interactivos reales, máximo 3.
- [x] **`enviarLista()`**: Reemplazado texto con emojis por clase `List` nativa. Agregado `guardarUltimosBotones()` para que el parseo numérico funcione.
- [x] **tasks.md**: Limpiadas tareas ya completadas (timeout, rate limit, socket.io, notificaciones, /ticket #id, CRUD, deploy Vercel).
- [x] **README.md**: Removidas referencias a archivos/APIs inexistentes (Meta API, workers/, queue/, types/index.ts, instructions.md, "en curso" → "en_proceso").

---

## Pendiente (real)

### 🔴 Bloqueantes
- [ ] **Deploy frontend en Vercel**
- [ ] **Validar `user.baseId` antes de `!`** en `handlers/ticket.ts:92`
- [ ] **Asociar `ticketId` en historial** — `Conversacion.ticketId` siempre es null

### 🟡 Alta prioridad
- [ ] **Tests** — 0 unitarios, 0 integración
- [ ] **Renombrar creds DB** — `norbridge` → `dgcatra` en docker-compose.yml y seed.ts
- [ ] **Manejar email duplicado** — upsert en `guardarUsuario()` puede fallar silenciosamente
- [ ] **Graceful shutdown** — cerrar Puppeteer + DB en SIGTERM
- [ ] **Endpoint `/health/bot`** — verificar `client.info?.wid`

### 🟢 Media prioridad
- [ ] **Endpoint historial conversaciones** — `GET /api/conversaciones?telefono=X`
- [ ] **Gráficos Recharts** en dashboard home (ya instalado, sin usar)
- [ ] **Logging estructurado** — reemplazar `console.log` por pino/winston
- [ ] **Seed con nombres GCBA** — reemplazar "Base Piedras / Base Once"

---

## Historial (completado)

### 2026-08-04 — Fix typing + rate limit + colas
- [x] **Typing**: inyección directa `WAWebChatStateBridge.sendChatStateComposing()` via `pupPage.evaluate()`
- [x] **Rate limit**: 2s por usuario en `enviar.ts` y `whatsapp.ts` (norbridge)
- [x] **Debug error "r"**: diagnosticado como fallo de `getChatById` por serialización de modelo Chat

### 2026-07-31 — Restructuración: botones, typing, historial
- [x] Session.ts con caché LRU + timeout 15 min
- [x] Historial.ts persistiendo `conversaciones`
- [x] Cola FIFO por usuario (`Map<tel, Promise>`)
- [x] sendSeen() antes de responder
- [x] ChatId caché (@c.us / @lid)
- [x] Docker con `.wwebjs_auth` bind mount, `shm_size: 2gb`, rotación logs

### 2026-07-29 — Migración: Meta API → whatsapp-web.js
- [x] whatsapp-web.js + qrcode-terminal + puppeteer
- [x] Eliminados workers/, queue/, Redis, Meta webhook
- [x] Auth OTP: Redis → Map en memoria

### 2026-07-27 — Seguridad, estructura, tickets
- [x] Admin middleware + rate limiting + Socket.IO JWT auth
- [x] Flujo creación ticket WhatsApp (4 pasos)
- [x] Comandos: /mis-tickets, /ticket #id, ayuda
- [x] Dashboard: CRUD bases/sectores/usuarios, stats, notificaciones WhatsApp
