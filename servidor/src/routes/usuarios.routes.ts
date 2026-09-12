import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as usuarios from '../controllers/usuarios.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', usuarios.getAll);
router.post('/', adminMiddleware, usuarios.create); // Ruta para crear administradores (valida super admin internamente)
router.get('/:telefono', usuarios.getByTelefono);
router.patch('/:telefono', adminMiddleware, usuarios.update);
router.delete('/:telefono', adminMiddleware, usuarios.remove);

export default router;
