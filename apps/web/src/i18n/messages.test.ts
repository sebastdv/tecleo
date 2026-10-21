import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import es from '../../messages/es.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(message: string): string[] {
  // Variable ICU: un nombre seguido de "," o "}". El texto de las ramas plurales no cuenta.
  return [
    ...new Set([...message.matchAll(/\{(\w+)\s*[,}]/g)].map((match) => match[1] ?? '')),
  ].sort();
}

describe('mensajes', () => {
  it('español e inglés tienen exactamente las mismas claves', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });

  it('cada traducción usa las mismas variables que el original', () => {
    const lookup = (source: unknown, path: string) =>
      path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], source);
    for (const path of keys(es)) {
      const original = lookup(es, path);
      const translated = lookup(en, path);
      if (typeof original === 'string' && typeof translated === 'string') {
        expect(placeholders(translated), path).toEqual(placeholders(original));
      }
    }
  });
});
