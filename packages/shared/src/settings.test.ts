import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, parseSettings } from './settings.js';

describe('parseSettings', () => {
  it('completa los campos que faltan con los valores por defecto', () => {
    expect(parseSettings({ theme: 'forest' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'forest' });
  });

  it('reemplaza valores inválidos campo por campo sin perder los válidos', () => {
    const parsed = parseSettings({ theme: 'neón', soundVolume: 7, keySound: 'click' });
    expect(parsed.theme).toBe('ink');
    expect(parsed.soundVolume).toBe(0.5);
    expect(parsed.keySound).toBe('click');
  });

  it('acepta cualquier entrada sin lanzar', () => {
    for (const value of [null, undefined, 'texto', 42, []]) {
      expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('los sonidos vienen desactivados y el tema por defecto es oscuro', () => {
    expect(DEFAULT_SETTINGS.keySound).toBe('off');
    expect(DEFAULT_SETTINGS.theme).toBe('ink');
  });
});
