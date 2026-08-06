import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as stats from '../controllers/stats.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/resumen', stats.resumen);
router.get('/por-base', stats.porBase);
router.get('/por-mes', stats.porMes);
router.get('/top-usuarios', stats.topUsuarios);
router.delete('/tickets', adminMiddleware, stats.eliminarTickets);
router.delete('/usuarios', adminMiddleware, stats.eliminarUsuarios);

export default router;
