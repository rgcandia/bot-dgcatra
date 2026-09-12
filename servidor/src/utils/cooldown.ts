/**
 * Cooldown en memoria por clave (normalmente un teléfono).
 *
 * Sirve para evitar reenvíos duplicados cuando un usuario aprieta varias veces
 * un botón que dispara un mensaje de WhatsApp (OTP de login, invitación a un
 * admin nuevo, etc.). Aunque el frontend ya bloquea el doble click, esto es la
 * red de seguridad del backend: cubre requests concurrentes, varias pestañas o
 * cualquier cliente que no sea el dashboard.
 *
 * Es estado por proceso: alcanza porque la API corre en una única instancia.
 */

const ultimos = new Map<string, number>();

/** ¿La clave está en cooldown? Devuelve cuántos segundos faltan para reintentar. */
export function enCooldown(clave: string, ms: number): { activo: boolean; restanteSeg: number } {
  const ultimo = ultimos.get(clave);
  if (ultimo === undefined) return { activo: false, restanteSeg: 0 };

  const transcurrido = Date.now() - ultimo;
  if (transcurrido >= ms) return { activo: false, restanteSeg: 0 };

  return { activo: true, restanteSeg: Math.max(1, Math.ceil((ms - transcurrido) / 1000)) };
}

/** Marca la clave como "recién enviada". Llamar SOLO si el envío fue exitoso. */
export function marcarEnviado(clave: string, ms: number) {
  const ahora = Date.now();
  ultimos.set(clave, ahora);

  // Limpieza perezosa para que el Map no crezca sin límite.
  if (ultimos.size > 500) {
    for (const [k, t] of ultimos) {
      if (ahora - t >= ms) ultimos.delete(k);
    }
  }
}

/** Solo para tests: limpia el estado en memoria entre casos. */
export function limpiarCooldowns() {
  ultimos.clear();
}
