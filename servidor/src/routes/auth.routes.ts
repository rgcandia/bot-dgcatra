import { Router } from 'express';
import { solicitarCodigo, verificarCodigo } from '../controllers/auth.controller.js';

const router = Router();
router.post('/solicitar-codigo', solicitarCodigo);
router.post('/verificar-codigo', verificarCodigo);

export default router;
