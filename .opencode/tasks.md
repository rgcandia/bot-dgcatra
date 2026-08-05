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
- [x] **Timeout de sesión**: limpiar context después de 15 min de inactividad
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

---

### 2026-08-05 — Rediseño frontend: logos GCBA, paleta de colores, lucide-react

- [x] **Logos GCBA**: descargados de Google Drive, fondo removido con sharp (análisis de color dominante en esquinas)
- [x] **Paleta de colores GCBA**: `#1A2C3F` (azul noche), `#B6FF18` (verde lima), `#A2A6AB` (gris plata), `#FFD700` (amarillo vial)
- [x] **DGCATRA** en mayúsculas en login y sidebar
- [x] **Login con loading**: spinner y botón código maestro deshabilitado mientras se envía OTP

### 2026-08-05 (4) — UX flujo de tickets + escudo anti-duplicados + chatId persistente

- [x] **Escudo anti-duplicados**: `Set<string>` con TTL 15s en `index.ts` (mismo que norbridge)
- [x] **Menú simplificado**: sin duplicación de opciones (body no lista, solo botones). Opción "Cancelar" (4)
- [x] **Ticket creation**: confirmación con texto SI/NO en vez de botones. Ejemplos sin mencionar sector/base
- [x] **Comandos no reconocidos → ticket**: en vez de "no entendí", inicia creación de ticket automáticamente
- [x] **`guardarUsuario` duplicado**: removida segunda llamada en `PEDIR_UBICACION`
- [x] **`chatId` persistente**: columna `chatId` en User, se guarda `msg.from` completo (`@c.us` o `@lid`). `resolverChatId()` busca DB como fallback cuando la cache en memoria está vacía.
- [x] **Historial JSON**: `ticket.changed('historial', true)` para que Sequelize detecte cambios en columna JSON
- [x] **Prioridad editable**: selector baja/media/alta en TicketDetail (solo admin)

### 2026-08-05 (5) — Rediseño layout + registro sin email + selects

- [x] **Sidebar**: sin título DGCATRA, usuario y botón Salir al pie
- [x] **Header**: fondo blanco + logo GCBA largo. Admin badge solo si login con master code
- [x] **UsuariosPage**: "Teléfono" → "ID WhatsApp", columna Admin muestra true/false
- [x] **Registro sin email**: eliminado paso 5 (email). Flujo: código base → sector → nombre → confirmar
- [x] **Confirmación**: muestra "🛡️ Admin" solo si es admin, sin etiqueta de sector extra
- [x] **Selects**: estilos limpios, foco azul oscuro

- [x] **BaseSector eliminado**: tabla `bases_sectores` removida, sectores son globales (todas las bases comparten los mismos)
- [x] **Registro simplificado**: `paso1CodigoBase` muestra todos los sectores sin filtrar por base (~2 queries menos)
- [x] **SectoresPage**: sin columna de bases asignadas, sin modal de asignación (más simple)
- [x] **Seed actualizado**: 3 sectores fijos (Operativo, Administrativo, Soporte Técnico)
- [x] **Admin pages**: `alert()` → estado `error` inline, `.form-group` wrappers en modales
- [x] **UsuariosPage**: búsqueda por nombre/teléfono/base/sector, badges en vez de emojis
- [x] **LoginPage**: spinner CSS en carga inicial + al enviar código
- [x] **useSocket**: removidos console.log y emojis
- [x] **⚠️ Timeout sesión aumentado**: `SESION_TTL` 15 min → 60 min. El registro de 6 pasos requiere más tiempo.

- [x] **Lucide React**: reemplazados 23 emojis por iconos profesionales (LayoutDashboard, Ticket, Building2, Settings2, Users, ShieldCheck, ClipboardCheck, CircleCheckBig, ArrowLeft)
- [x] **Componentes extraídos**: `<NavItem>`, `<StatCard>` — eliminada duplicación 5x en sidebar y 6x en dashboard
- [x] **Fix `TicketDetail`**: `navigate('/')` → `navigate('/tickets')` + eliminado `window.location.reload()` + errores con try/catch
- [x] **Fix `TicketsList`**: migrado `fetch()` → `api.get()`, badges de prioridad usan clases CSS en vez de inline
- [x] **Fix `DashboardHome`**: migrado a `StatCard`, badges en tabla de bases
- [x] **Fix CSS**: agregadas clases faltantes (`.input`, `.badge-alta/media/baja`), `tr:hover`, color `--warning` unificado
- [x] **Colores inconsistentes**: `#e76f51` → `var(--warning)` en en_proceso y prioridad media

- [x] **Eliminado paso de rol separado**: el sector "Soporte Técnico" es automáticamente admin (pide código `admin2024`)
- [x] **Sectores renombrados**: Operativo, Administrativo, Soporte Técnico
- [x] **Flujo final**: base → sector → admin code (si Soporte Técnico) → nombre → email → confirmar

### 2026-08-04 (6) — Registro de admin con código + selección de rol (revertido, ver #7)

- [x] **Paso 5 (rol)**: nuevo paso en el registro por WhatsApp con botones "Agente" / "Admin"
- [x] **Paso 6 (admin)**: si elige Admin, pide código de autorización (`ADMIN_CODE` runtime)
- [x] **Flujo completo**: agente → 1 código (base). admin → 2 códigos (base + admin)
- [x] **Admin code en dashboard**: editable desde 🔐 Configuración (junto con código maestro)

### 2026-08-04 (5) — Login: OTP real por WhatsApp + código maestro + auto-logout

- [x] **OTP por WhatsApp**: `solicitarCodigo` envía el código al WhatsApp del usuario vía `enviarTexto()` (no más `console.log`)
- [x] **Código maestro**: `MASTER_CODE` en `.env` como backup si no llega el OTP
- [x] **Normalizar teléfono**: acepta `1166086509` → normaliza a `5491166086509`
- [x] **Auto-logout por inactividad**: 30 min sin actividad → cierra sesión automáticamente
- [x] **JWT 24h**: token expira en 24 horas, renovable al re-loguearse
- [x] **`.env` limpiado**: removidas variables obsoletas (Redis, Meta API, Groq)

### 2026-08-04 (4) — Fix puntos débiles

> **Lección:** WhatsApp descontinuó el soporte para `Buttons` y `List` nativos de whatsapp-web.js. El `sendMessage()` con estas clases imprime `"Buttons are now deprecated"` y falla silenciosamente — el mensaje nunca se entrega. **NO volver a intentar usar `Buttons`/`List` de whatsapp-web.js.**

- [x] **Revertido `enviarBotones()`**: vuelve a texto con emojis (único enfoque funcional)
- [x] **Revertido `enviarLista()`**: vuelve a texto con emojis + `guardarUltimosBotones()`
- [x] **`guardarUltimosBotones()` en `enviarLista()`**: se mantiene (el fix del parseo numérico sí era necesario)

### 2026-08-04 (2) — Limpieza tasks.md + README.md

- [x] Limpiadas tareas ya completadas, agregados bugs reales detectados
- [x] README: removidas refs a Meta API, workers/, queue/, types/index.ts, instructions.md

### 2026-08-04 (4) — Fix puntos débiles

- [x] **`user.baseId!` validado** (`ticket.ts:89-92`): si es null devuelve error claro en vez de explotar
- [x] **`paso2SectorNumerico` sin queries duplicadas** (`registro.ts:126-147`): usa `_lastButtons` en vez de 2 queries a DB
- [x] **`ticketId` en historial** (`ticket.ts:113-116`): `Conversacion.update` asocia mensajes recientes al ticket creado. `enviarTexto/Botones/Lista` aceptan `ticketId` opcional

---

## Pendiente (real)

### 🔴 Bloqueantes
- [ ] **Deploy frontend en Vercel**

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
