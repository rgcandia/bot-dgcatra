import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { getMasterCode, setMasterCode, setAdminCode, limpiarDB } from '../controllers/settings.controller.js';
import { logger } from '../config/logger.js';

const router = Router();

router.get('/master-code', authMiddleware, adminMiddleware, getMasterCode);
router.patch('/master-code', authMiddleware, adminMiddleware, setMasterCode);
router.patch('/admin-code', authMiddleware, adminMiddleware, setAdminCode);
router.post('/limpiar-db', authMiddleware, adminMiddleware, limpiarDB);
router.post('/logout-whatsapp', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { client } = await import('../bot/whatsapp.js');
    const { setBotDisconnected } = await import('../socket/server.js');
    const fs = await import('fs');
    logger.info('Intentando desvincular WhatsApp...');
    try {
      await client.logout();
    } catch (e: any) {
      logger.warn({ err: e.message }, 'logout() falló, forzando destroy');
      try { await client.destroy(); } catch {}
    }
    // Limpiar sesión y reiniciar
    try {
      fs.rmSync('.wwebjs_auth/session-dgcatra', { recursive: true, force: true });
      logger.info('Sesión borrada del disco');
    } catch {}
    setBotDisconnected();
    // Reiniciar el cliente para que genere QR nuevo
    setTimeout(async () => {
      try { await client.initialize(); logger.info('Cliente reiniciado'); } catch {}
    }, 2000);
    logger.info('WhatsApp desvinculado');
    res.json({ ok: true });
  } catch (e: any) {
    logger.error({ err: e.message }, 'Error al desvincular WhatsApp');
    res.status(500).json({ error: e.message || 'Error al desvincular' });
  }
});

export default router;
