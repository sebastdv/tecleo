import { THEMES } from '@tecleo/shared';
import { describe, expect, it } from 'vitest';

import { contrastRatio, THEME_TOKENS, themeCss } from './themes';

describe('contrastRatio', () => {
  it('coincide con los valores de referencia de WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe.each(THEMES)('tema %s (WCAG 2.1 AA)', (id) => {
  const t = THEME_TOKENS[id];

  it('texto principal y secundario ≥ 4.5:1 sobre fondo y paneles', () => {
    for (const background of [t.background, t.surface]) {
      expect(contrastRatio(t.foreground, background)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(t.mutedForeground, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(t.mutedForeground, t.muted)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto pendiente y errores se leen sobre el fondo (≥ 4.5:1)', () => {
    expect(contrastRatio(t.pending, t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.error, t.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('el texto escrito se distingue del pendiente', () => {
    expect(contrastRatio(t.foreground, t.pending)).toBeGreaterThanOrEqual(1.8);
  });

  it('el acento se lee como texto (≥ 4.5:1) y como fondo de botón (≥ 4.5:1)', () => {
    expect(contrastRatio(t.accent, t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accent, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accentForeground, t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('themeCss', () => {
  it('define cada tema y usa el oscuro por defecto en :root', () => {
    const css = themeCss();
    for (const id of THEMES) expect(css).toContain(`[data-theme="${id}"]`);
    expect(css).toMatch(/^:root,\[data-theme="ink"\]\{color-scheme:dark;/);
  });
});
