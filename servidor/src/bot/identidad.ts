/**
 * Identidad de WhatsApp: LID vs. teléfono.
 *
 * WhatsApp convive con dos identificadores por cuenta:
 *   - PN  (Phone Number): `5491166086509@c.us`  → el teléfono de siempre.
 *   - LID (Linked ID):    `30262373163147@lid`  → id interno nuevo (cuentas migradas a LID).
 *
 * Cuando el que escribe usa LID, `msg.from` trae el LID y NO el teléfono, así que el bot
 * guardaba un id que la validación de Argentina rechaza (ej. no se podía dar de alta como admin).
 * Acá se traduce el LID a su teléfono real con `client.getContactLidAndPhone()` y se usa el
 * teléfono como identidad, conservando el LID como `chatId` para poder responderle.
 *
 * Si la resolución falla, se sigue con el LID (comportamiento anterior): nunca se rompe el flujo.
 */
import type { Client } from 'whatsapp-web.js';
import { normalizarTelefonoAR } from '../utils/telefono.js';
import { logger } from '../config/logger.js';
import { obtenerCliente } from './enviar.js';

export interface Identidad {
  /** Identidad para la DB (teléfono real si se pudo resolver; si no, el id que mandó WhatsApp). */
  telefono: string;
  /** A dónde responder (`@c.us` o `@lid`). */
  chatId: string;
  /** true si el LID se resolvió al teléfono real. */
  resuelto: boolean;
}

/** Solo dígitos de un id de WhatsApp: `5491166086509@c.us` → `5491166086509`. */
export function limpiarNumero(raw: string): string {
  return (raw || '').split('@')[0].replace(/[^\d]/g, '');
}

/** ¿El id que mandó WhatsApp es un LID? */
export function esLid(raw: string): boolean {
  return /@lid$/i.test((raw || '').trim());
}

// Caché lid → teléfono (solo resoluciones exitosas: si falla, se reintenta en el próximo mensaje).
const cacheTelefono = new Map<string, string>();

/** Para tests: vaciar la caché entre casos. */
export function limpiarCacheIdentidad() {
  cacheTelefono.clear();
}

export async function resolverIdentidad(rawFrom: string, client?: Client | null): Promise<Identidad> {
  const fallback: Identidad = { telefono: limpiarNumero(rawFrom), chatId: rawFrom, resuelto: false };

  if (!esLid(rawFrom)) return fallback;

  const enCache = cacheTelefono.get(rawFrom);
  if (enCache) return { telefono: enCache, chatId: rawFrom, resuelto: true };

  const wa = client ?? obtenerCliente();
  if (!wa) return fallback;

  try {
    const [res] = await wa.getContactLidAndPhone([rawFrom]);
    const pn = res?.pn ? limpiarNumero(res.pn) : '';
    if (!pn) {
      logger.warn({ lid: rawFrom }, 'El LID no tiene teléfono asociado (pn vacío)');
      return fallback;
    }
    const telefono = normalizarTelefonoAR(pn) || pn;
    cacheTelefono.set(rawFrom, telefono);
    logger.info({ lid: rawFrom, telefono }, 'Identidad LID resuelta a teléfono');
    return { telefono, chatId: rawFrom, resuelto: true };
  } catch (e: any) {
    logger.warn({ err: e?.message, lid: rawFrom }, 'No se pudo resolver el LID a teléfono');
    return fallback;
  }
}
