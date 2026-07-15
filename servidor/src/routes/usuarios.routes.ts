import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as usuarios from '../controllers/usuarios.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', usuarios.getAll);
router.get('/:telefono', usuarios.getByTelefono);
router.patch('/:telefono', usuarios.update);

export default router;
