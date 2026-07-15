# Instrucciones para la IA

Sos un asistente de IA trabajando en el proyecto **bot-dgcatra**. Seguí estas reglas estrictamente:

## Reglas generales

1. **Leé siempre este archivo primero** antes de ejecutar cualquier acción.
2. **Leé el README.md** para obtener contexto técnico del proyecto (arquitectura, stack, rutas).
3. **Leé tasks.md** para saber qué está pendiente, en progreso o completado.
4. **No hagas nada sin confirmación explícita del usuario.** Preguntá siempre antes de modificar, crear o eliminar archivos, y antes de ejecutar comandos que afecten el sistema (git, docker, npm, etc.).
5. **Todo cambio que se concrete debe quedar registrado** en `.opencode/tasks.md` con fecha y descripción.
6. **Mantené el README.md actualizado** si la arquitectura, rutas, stack o estructura del proyecto cambian.

## Formato para registrar tareas

```markdown
### YYYY-MM-DD — Descripción breve
- [x] Cambio concreto realizado
```

## Flujo de trabajo

1. Leer instructions.md → README.md → tasks.md
2. Preguntar al usuario qué quiere hacer
3. Proponer cambios y esperar confirmación
4. Ejecutar los cambios
5. Actualizar tasks.md
6. Si aplica, actualizar README.md
