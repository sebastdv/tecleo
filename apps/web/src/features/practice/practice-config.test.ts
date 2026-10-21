import { describe, expect, it } from 'vitest';

import { buildPracticeText, DEFAULT_CONFIG, TIME_MODE_INITIAL_WORDS } from './practice-config';

describe('buildPracticeText', () => {
  it('modo por palabras: genera la cantidad pedida y es reproducible por semilla', async () => {
    const config = { ...DEFAULT_CONFIG, mode: 'words' as const, wordCount: 25 as const };
    const a = await buildPracticeText(config, 'es', 123);
    const b = await buildPracticeText(config, 'es', 123);
    expect(a.text).toBe(b.text);
    expect(a.text.split(' ')).toHaveLength(25);
    expect(a.more).toBeNull();
  });

  it('modo por tiempo: empieza con un bloque y puede generar más con la misma semilla', async () => {
    const config = { ...DEFAULT_CONFIG, mode: 'time' as const };
    const a = await buildPracticeText(config, 'es', 7);
    const b = await buildPracticeText(config, 'es', 7);
    expect(a.text.split(' ')).toHaveLength(TIME_MODE_INITIAL_WORDS);
    expect(a.more?.(10)).toBe(b.more?.(10));
  });

  it('modo texto: cita con atribución o fragmento de código con saltos de línea', async () => {
    const quote = await buildPracticeText(
      { ...DEFAULT_CONFIG, mode: 'text', quoteLength: 'short' },
      'es',
      1,
    );
    expect(quote.quote?.lengthCategory).toBe('short');
    expect(quote.text).toBe(quote.quote?.content);

    const code = await buildPracticeText(
      { ...DEFAULT_CONFIG, mode: 'text', textKind: 'code' },
      'es',
      1,
    );
    expect(code.preserveLines).toBe(true);
    expect(code.text).toContain('\n');
  });

  it('no repite el texto anterior', async () => {
    const config = { ...DEFAULT_CONFIG, mode: 'text' as const, textKind: 'code' as const };
    const first = await buildPracticeText(config, 'es', 1);
    const second = await buildPracticeText(config, 'es', 1, first.snippet?.id);
    expect(second.snippet?.id).not.toBe(first.snippet?.id);
  });
});
