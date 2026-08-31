const AFIRMATIVO = ['si', 'sí', 'dale', 'ok', 'confirmo', 'registrarme', 'registrar', 'registro', 'comenzar', 'empezar', 'iniciar', 'confirmar'];
const NEGATIVO = ['no', 'cancelar', 'salir', 'cancelo', 'abortar', 'terminar', 'finalizar'];
const CANCELAR = ['cancelar', 'salir', 'abortar', 'terminar', 'finalizar'];
const CORTESIA = ['gracias', 'gracia', 'ok', 'dale', 'listo', 'genial', 'perfecto', 'buenisimo', 'excelente', 'chau', 'adios', 'nos vemos', 'buen dia', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'];

function coincide(texto: string, palabras: string[]): boolean {
  const t = texto.toLowerCase().trim().replace(/[.,!?¿¡;:]/g, '');
  return palabras.some(p => t === p || t.startsWith(`${p} `));
}

export function esAfirmativo(texto: string): boolean {
  return coincide(texto, AFIRMATIVO);
}

export function esNegativo(texto: string): boolean {
  return coincide(texto, NEGATIVO);
}

export function esCancelar(texto: string): boolean {
  return coincide(texto, CANCELAR) || esCercano(texto, 'cancelar');
}

export function esCortesia(texto: string): boolean {
  return coincide(texto, CORTESIA);
}

export function normalizar(texto: string): string {
  return texto.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export function esCercano(texto: string, objetivo: string, maxDist = 1): boolean {
  const t = normalizar(texto).replace(/[.,!?¿¡;:]/g, '');
  const o = normalizar(objetivo);
  if (Math.abs(t.length - o.length) > maxDist) return false;
  return distanciaLevenshtein(t, o) <= maxDist;
}
