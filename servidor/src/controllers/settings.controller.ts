import { Request, Response } from 'express';
import { getSetting, setSetting } from '../config/settings.js';

export function getMasterCode(_req: Request, res: Response) {
  res.json({ masterCode: getSetting('masterCode') });
}

export function setMasterCode(req: Request, res: Response) {
  const { masterCode } = req.body;
  if (typeof masterCode !== 'string' || masterCode.length === 0) {
    return res.status(400).json({ error: 'masterCode requerido' });
  }
  setSetting('masterCode', masterCode);
  console.log('🔐 Código maestro actualizado');
  res.json({ ok: true });
}
