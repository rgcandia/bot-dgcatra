import { describe, it, expect } from 'vitest';
import { esCercano, esCancelar, normalizar } from '../bot/helpers.js';

describe('esCercano', () => {
  it('detecta typo ayusa como ayuda', () => {
    expect(esCercano('ayusa', 'ayuda')).toBe(true);
  });

  it('detecta typo tikets como tickets', () => {
    expect(esCercano('tikets', 'tickets')).toBe(true);
  });

  it('detecta typo canelar como cancelar', () => {
    expect(esCercano('canelar', 'cancelar')).toBe(true);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(esCercano('AYUDA', 'ayuda')).toBe(true);
    expect(esCercano('ayudá', 'ayuda')).toBe(true);
  });

  it('no matchea palabras lejanas', () => {
    expect(esCercano('ayuno', 'ayuda')).toBe(false);
    expect(esCercano('la impresora no funciona', 'ayuda')).toBe(false);
  });
});

describe('esCancelar', () => {
  it('matchea cancelar exacto y variantes', () => {
    expect(esCancelar('cancelar')).toBe(true);
    expect(esCancelar('salir')).toBe(true);
    expect(esCancelar('canelar')).toBe(true);
  });

  it('no matchea una descripción larga', () => {
    expect(esCancelar('no se puede cancelar la impresión')).toBe(false);
  });
});

describe('normalizar', () => {
  it('quita tildes y baja a minúsculas', () => {
    expect(normalizar('Ayudá')).toBe('ayuda');
  });
});
