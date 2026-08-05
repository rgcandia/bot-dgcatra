import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { getMasterCode, setMasterCode, setAdminCode } from '../controllers/settings.controller.js';

const router = Router();

router.get('/master-code', authMiddleware, adminMiddleware, getMasterCode);
router.patch('/master-code', authMiddleware, adminMiddleware, setMasterCode);
router.patch('/admin-code', authMiddleware, adminMiddleware, setAdminCode);
router.post('/logout-whatsapp', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { client } = await import('../bot/whatsapp.js');
    await client.logout();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
