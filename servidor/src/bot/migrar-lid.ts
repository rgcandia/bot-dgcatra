/**
 * Consolidación de usuarios que quedaron guardados con LID en vez de teléfono.
 *
 * Antes de resolver la identidad (`identidad.ts`), el bot guardaba el LID como `telefono`
 * (ej. `30262373163147`). Cuando ese LID se resuelve a su teléfono real, esta función
 * consolida los datos: crea/reutiliza la fila del teléfono real, le mueve tickets y
 * conversaciones, y borra la fila vieja. Así el usuario no queda duplicado ni pierde historial.
 */
import { sequelize } from '../config/database.js';
import { User, Ticket, Conversacion } from '../models/models.js';
import { logger } from '../config/logger.js';

// LIDs ya revisados en este proceso (evita un SELECT extra por cada mensaje).
const revisados = new Set<string>();

/** Para tests: permitir revisar de nuevo el mismo LID. */
export function resetearCacheMigracion() {
  revisados.clear();
}

export async function migrarUsuarioDeLid(telefonoLid: string, telefonoReal: string): Promise<boolean> {
  if (!telefonoLid || !telefonoReal || telefonoLid === telefonoReal) return false;
  if (revisados.has(telefonoLid)) return false;

  const viejo = await User.findByPk(telefonoLid);
  if (!viejo) {
    revisados.add(telefonoLid);
    return false;
  }

  try {
    await sequelize.transaction(async (t) => {
      const existente = await User.findByPk(telefonoReal, { transaction: t, lock: t.LOCK.UPDATE });

      let destino = existente;
      if (!destino) {
        // Sin fila destino: se replica la vieja con el teléfono real (mismos datos, permisos e historial).
        const datos = viejo.toJSON() as Record<string, any>;
        delete datos.telefono;
        destino = await User.create({ ...datos, telefono: telefonoReal }, { transaction: t });
      }

      // El chatId del LID es el único que sirve para responderle: se conserva en la fila destino.
      if (viejo.chatId && destino.chatId !== viejo.chatId) {
        await destino.update({ chatId: viejo.chatId }, { transaction: t });
      }

      await Ticket.update({ userTelefono: telefonoReal }, { where: { userTelefono: telefonoLid }, transaction: t });
      await Ticket.update({ tecnicoTelefono: telefonoReal }, { where: { tecnicoTelefono: telefonoLid }, transaction: t });
      await Conversacion.update({ userTelefono: telefonoReal }, { where: { userTelefono: telefonoLid }, transaction: t });

      await viejo.destroy({ transaction: t });
    });

    revisados.add(telefonoLid);
    logger.info({ telefonoLid, telefonoReal }, 'Usuario con LID consolidado al teléfono real');
    return true;
  } catch (e: any) {
    logger.error({ err: e?.message, telefonoLid, telefonoReal }, 'No se pudo consolidar el usuario con LID');
    return false;
  }
}
