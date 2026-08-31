import type { CorsOptions } from 'cors';

const BASE_ORIGINS = [
  'https://dgcatra.alejndrogcandia.online',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://172.17.0.202:5173',
];

export const corsOrigin: CorsOptions['origin'] = (origin, cb) => {
  // Sin Origin (curl, navegación directa) u Origin: null (algunos modos de Firefox) -> permitir
  if (!origin || origin === 'null') return cb(null, true);

  const extra = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
  const allowed = [...BASE_ORIGINS, ...extra];

  if (allowed.includes(origin)) return cb(null, true);

  // Cualquier subdominio de Vercel (producción + previews/aliases)
  if (/^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin)) return cb(null, true);

  // No permitido: se omite el header CORS (el navegador bloquea) en vez de responder error
  cb(null, false);
};
