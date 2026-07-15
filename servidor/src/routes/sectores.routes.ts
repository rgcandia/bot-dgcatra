import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as sectores from '../controllers/sectores.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', sectores.getAll);
router.post('/', sectores.create);
router.patch('/:id', sectores.update);
router.delete('/:id', sectores.remove);

router.get('/base/:baseId', sectores.getSectoresDeBase);
router.post('/asignar', sectores.asignarSectorABase);
router.delete('/base/:baseId/sector/:sectorId', sectores.removerSectorDeBase);

export default router;
