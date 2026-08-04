import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { getMasterCode, setMasterCode } from '../controllers/settings.controller.js';

const router = Router();

router.get('/master-code', authMiddleware, adminMiddleware, getMasterCode);
router.patch('/master-code', authMiddleware, adminMiddleware, setMasterCode);

export default router;
