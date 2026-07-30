# Tareas - bot-dgcatra

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

#### Pendiente
- [ ] Agregar dependencias: `whatsapp-web.js`, `qrcode-terminal`, `puppeteer`
- [ ] Actualizar Dockerfile: instalar Chrome + librerías
- [ ] Crear `src/bot/whatsapp.ts`: cliente WhatsApp con LocalAuth + QR
- [ ] Reemplazar `src/bot/enviar.ts`: Meta API → `client.sendMessage()`
- [ ] Eliminar webhook Meta de `src/api/index.ts`
- [ ] Eliminar BullMQ + Workers (los mensajes llegan por evento)
- [ ] Eliminar Redis de docker-compose.yml
- [ ] Limpiar .env: sacar vars Meta, agregar CHROME_PATH
- [ ] Probar en Docker con QR

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
