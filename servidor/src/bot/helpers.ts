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
  return coincide(texto, CANCELAR);
}

export function esCortesia(texto: string): boolean {
  return coincide(texto, CORTESIA);
}

export function normalizar(texto: string): string {
  return texto.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
