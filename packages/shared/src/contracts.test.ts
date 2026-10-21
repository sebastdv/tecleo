import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from './auth.js';
import { encodedKeystrokesSchema, submitResultSchema } from './results.js';

describe('registerSchema', () => {
  it('normaliza el correo y valida apodo y contraseña', () => {
    const parsed = registerSchema.parse({
      email: '  Ana@Example.COM ',
      password: '12345678',
      nickname: 'ana_92',
    });
    expect(parsed.email).toBe('ana@example.com');
    expect(registerSchema.safeParse({ ...parsed, nickname: 'añ' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...parsed, nickname: 'con espacio' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...parsed, password: 'corta' }).success).toBe(false);
  });

  it('el login exige correo válido', () => {
    expect(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }).success).toBe(false);
  });
});

describe('encodedKeystrokesSchema', () => {
  it('exige un tiempo por cada pulsación, contando tildes y borrados como uno', () => {
    expect(encodedKeystrokesSchema.safeParse({ deltas: [0, 10, 5], inputs: 'á\bñ' }).success).toBe(
      true,
    );
    expect(encodedKeystrokesSchema.safeParse({ deltas: [0, 10], inputs: 'abc' }).success).toBe(
      false,
    );
  });
});

describe('submitResultSchema', () => {
  const base = {
    mode: 'practice',
    textId: null,
    content: 'hola mundo',
    preserveLines: false,
    language: 'es',
    rules: { mode: 'free', ignoreAccents: false },
    timeLimitMs: null,
    practiceKind: 'words',
    bots: null,
    keystrokes: { deltas: [0], inputs: 'h' },
    playedAt: new Date(0).toISOString(),
  } as const;

  it('acepta un resultado de práctica bien formado', () => {
    expect(submitResultSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza niveles de bot inexistentes y más de cinco bots', () => {
    const withBots = (levels: string[]) => ({ ...base, mode: 'bots', bots: { seed: 1, levels } });
    expect(submitResultSchema.safeParse(withBots(['dios'])).success).toBe(false);
    expect(
      submitResultSchema.safeParse(withBots(Array.from({ length: 6 }, () => 'legend'))).success,
    ).toBe(false);
  });
});
