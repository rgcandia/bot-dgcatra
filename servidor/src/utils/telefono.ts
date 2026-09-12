/**
 * Utilidades para el manejo y normalización de números de teléfono.
 * Formato canónico deseado: 54911XXXXXXXX (13 dígitos para Argentina)
 */

export function normalizarTelefonoAR(input: string): string | null {
  if (!input) return null;

  // Remover todo lo que no sea un dígito
  let clean = input.replace(/\D/g, '');

  // Si empieza con +, ya se removió en el paso anterior.
  // Casos comunes de Argentina:
  // El código de país es 54.
  // El prefijo de celular internacional es 9.
  // El código de área de Buenos Aires es 11 (u otros del interior, ej: 341, 261, 351, etc.)
  // El prefijo local de celular suele ser 15 (se debe remover al normalizar para formato internacional).

  // 1. Si empieza con 0, remover el 0 inicial (ej: 011 -> 11, o 0341 -> 341)
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // 2. Si empieza con 54, procesar prefijos
  if (clean.startsWith('54')) {
    // Caso: 54 9 ...
    if (clean.startsWith('549')) {
      // Remover un posible '15' si fue ingresado erróneamente después del 9 (ej: 5491511...)
      const resto = clean.substring(3);
      if (resto.startsWith('15')) {
        clean = '549' + resto.substring(2);
      }
    } else {
      // Caso: 54 11 ... (le falta el 9 internacional de móvil)
      // En Argentina, para móviles el formato internacional requiere el '9' antes del código de área.
      const resto = clean.substring(2);
      if (resto.startsWith('15')) {
        clean = '549' + resto.substring(2);
      } else {
        clean = '549' + resto;
      }
    }
  } else {
    // No empieza con 54. Es un número local, ej: 1166086509, 1566086509, 34115...
    if (clean.startsWith('15')) {
      // Caso 1566086509 -> asumimos Bs As (11) por defecto si tiene 10 dígitos incluyendo el 15, o quitamos 15
      // Pero para ser más genéricos, si empieza con 15 y tiene 10 dígitos (ej: 15 6608 6509), el código de área por defecto es 11.
      if (clean.length === 10) {
        clean = '54911' + clean.substring(2);
      } else {
        clean = '549' + clean.substring(2);
      }
    } else {
      // Si tiene 10 dígitos (ej: 1166086509)
      if (clean.length === 10) {
        clean = '549' + clean;
      } else if (clean.length === 8) {
        // Teléfono local sin código de área (ej: 66086509), asumimos 11 por defecto
        clean = '54911' + clean;
      } else {
        // En cualquier otro caso, agregar 549 al principio
        clean = '549' + clean;
      }
    }
  }

  // Limpieza final de un posible '15' residual en medio del número internacional
  // Ej: 549111566086509 -> 5491166086509
  if (clean.startsWith('549')) {
    const resto = clean.substring(3);
    // Códigos de área comunes en Argentina tienen 2, 3 o 4 dígitos.
    // Ej: Bs As es 11 (2 dígitos). 11 + 15 + XXXX...
    if (resto.startsWith('1115')) {
      clean = '54911' + resto.substring(4);
    } else {
      // Buscar '15' después de códigos de área de 3 o 4 dígitos
      // Para simplificar, si hay un '15' después del código de área:
      // Analicemos longitudes comunes de celular AR: 549 + área + número = 13 dígitos
      // Si tiene 15 dígitos y un '15' en el medio, lo removemos.
      // Ej: 549 341 15 6086509 (15 dígitos en total)
      if (clean.length === 15) {
        // 549 (3) + area (3) + 15 (2) + num (7) -> remover el 15 en pos 6 y 7
        const area = clean.substring(3, 6);
        const posible15 = clean.substring(6, 8);
        const num = clean.substring(8);
        if (posible15 === '15') {
          clean = '549' + area + num;
        }
      } else if (clean.length === 16) {
        // 549 (3) + area (4) + 15 (2) + num (7)
        const area = clean.substring(3, 7);
        const posible15 = clean.substring(7, 9);
        const num = clean.substring(9);
        if (posible15 === '15') {
          clean = '549' + area + num;
        }
      }
    }
  }

  // Validar longitud final razonable para Argentina (típicamente 13 dígitos)
  if (clean.length === 13 && clean.startsWith('549')) {
    return clean;
  }

  // Si no logramos formatearlo exactamente a 13 pero tiene entre 11 y 14 dígitos, lo dejamos pasar normalizado
  if (clean.length >= 10 && clean.length <= 15) {
    return clean.startsWith('549') ? clean : '549' + clean.substring(clean.startsWith('54') ? 2 : 0);
  }

  return null;
}
