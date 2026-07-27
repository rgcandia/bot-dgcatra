import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as bases from '../controllers/bases.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', bases.getAll);
router.get('/:id', bases.getById);
router.post('/', adminMiddleware, bases.create);
router.patch('/:id', adminMiddleware, bases.update);
router.delete('/:id', adminMiddleware, bases.remove);

export default router;
