import { config } from './index.js';
import { Setting } from '../models/Setting.js';
import { logger } from './logger.js';

const runtime = new Map<string, string>();

export function getSetting(key: string): string {
  return runtime.get(key) ?? '';
}

export function setSetting(key: string, value: string) {
  runtime.set(key, value);
  Setting.upsert({ clave: key, valor: value }).catch(e =>
    logger.warn({ err: e?.message }, `No se pudo persistir setting ${key}`));
}

export function initSettings() {
  if (config.masterCode) {
    runtime.set('masterCode', config.masterCode);
  }
}

// Carga los valores persistidos en DB, pisando los de .env solo si existen.
export async function loadSettingsFromDB() {
  try {
    const rows = await Setting.findAll();
    for (const row of rows) {
      if (row.valor) runtime.set(row.clave, row.valor);
    }
    logger.info(`Settings cargados desde DB: ${rows.length}`);
  } catch (e: any) {
    logger.warn({ err: e?.message }, 'No se pudieron cargar settings desde DB (se usa .env)');
  }
}
