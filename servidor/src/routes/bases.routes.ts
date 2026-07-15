import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as bases from '../controllers/bases.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', bases.getAll);
router.get('/:id', bases.getById);
router.post('/', bases.create);
router.patch('/:id', bases.update);
router.delete('/:id', bases.remove);

export default router;
