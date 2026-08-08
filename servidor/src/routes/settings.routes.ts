import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { getMasterCode, setMasterCode, setAdminCode, limpiarDB } from '../controllers/settings.controller.js';

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
    console.log('🔌 [Logout] Intentando desvincular WhatsApp...');
    try {
      await client.logout();
    } catch (e: any) {
      console.warn('⚠️ [Logout] logout() falló, forzando destroy:', e.message);
      try { await client.destroy(); } catch {}
    }
    // Limpiar sesión y reiniciar
    try {
      fs.rmSync('.wwebjs_auth/session-dgcatra', { recursive: true, force: true });
      console.log('  ✓ Sesión borrada del disco');
    } catch {}
    setBotDisconnected();
    // Reiniciar el cliente para que genere QR nuevo
    setTimeout(async () => {
      try { await client.initialize(); console.log('  ✓ Cliente reiniciado'); } catch {}
    }, 2000);
    console.log('✅ [Logout] WhatsApp desvinculado');
    res.json({ ok: true });
  } catch (e: any) {
    console.error('❌ [Logout] Error:', e.message);
    res.status(500).json({ error: e.message || 'Error al desvincular' });
  }
});

export default router;
