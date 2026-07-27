import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { solicitarCodigo, verificarCodigo } from '../controllers/auth.controller.js';

const router = Router();

const codeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Esperá 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/solicitar-codigo', codeLimiter, solicitarCodigo);
router.post('/verificar-codigo', codeLimiter, verificarCodigo);

export default router;
