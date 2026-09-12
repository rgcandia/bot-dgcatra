import { describe, it, expect } from 'vitest';
import { normalizarTelefonoAR } from '../utils/telefono';

describe('Normalización de Teléfonos de Argentina', () => {
  it('debería retornar null para inputs inválidos o vacíos', () => {
    expect(normalizarTelefonoAR('')).toBeNull();
    expect(normalizarTelefonoAR('abc')).toBeNull();
    expect(normalizarTelefonoAR('123')).toBeNull();
  });

  it('debería formatear números con código de país y celular correcto', () => {
    expect(normalizarTelefonoAR('5491166086509')).toBe('5491166086509');
  });

  it('debería agregar el 9 internacional de celular si tiene 5411...', () => {
    expect(normalizarTelefonoAR('541166086509')).toBe('5491166086509');
  });

  it('debería remover el 15 si se ingresa localmente', () => {
    expect(normalizarTelefonoAR('1566086509')).toBe('5491166086509'); // asume 11 por defecto
  });

  it('debería remover el 15 después del código de área de Buenos Aires (11)', () => {
    expect(normalizarTelefonoAR('111566086509')).toBe('5491166086509');
    expect(normalizarTelefonoAR('549111566086509')).toBe('5491166086509');
  });

  it('debería soportar códigos de área del interior con o sin 15', () => {
    // Rosario (341) con 15 y con 7 dígitos de número
    expect(normalizarTelefonoAR('341156086509')).toBe('5493416086509');
    expect(normalizarTelefonoAR('549341156086509')).toBe('5493416086509');
    expect(normalizarTelefonoAR('0341156086509')).toBe('5493416086509');
  });

  it('debería limpiar caracteres no numéricos', () => {
    expect(normalizarTelefonoAR('+54 9 (11) 6608-6509')).toBe('5491166086509');
    expect(normalizarTelefonoAR('011-15-6608-6509')).toBe('5491166086509');
  });
});
