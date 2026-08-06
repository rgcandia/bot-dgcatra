import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as chat from '../controllers/chat.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/:id/chat', chat.estadoChat);
router.post('/:id/chat/iniciar', adminMiddleware, chat.iniciarChat);
router.post('/:id/chat/enviar', adminMiddleware, chat.enviarMensaje);
router.post('/:id/chat/finalizar', adminMiddleware, chat.finalizarChat);

export default router;
