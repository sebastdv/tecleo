import type { CharStatEntry, KeyboardLayout } from '@tecleo/shared';

/** Filas de teclas (sin modificadores) de cada distribución; la última fila es la barra espaciadora. */
export const KEYBOARD_ROWS: Readonly<Record<KeyboardLayout, readonly (readonly string[])[]>> = {
  'es-ES': [
    ['º', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '¡'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '`', '+'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ', '´', 'ç'],
    ['<', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    [' '],
  ],
  'es-LA': [
    ['|', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '¿'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '´', '+'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ', '{', '}'],
    ['<', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    [' '],
  ],
  'en-US': [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
    [' '],
  ],
};

/** Caracteres que se escriben con Shift (o AltGr) sobre otra tecla, por distribución. */
const SHIFTED: Readonly<Record<KeyboardLayout, Readonly<Record<string, string>>>> = {
  'es-ES': {
    '!': '1',
    '"': '2',
    '·': '3',
    $: '4',
    '%': '5',
    '&': '6',
    '/': '7',
    '(': '8',
    ')': '9',
    '=': '0',
    '?': "'",
    '¿': '¡',
    ';': ',',
    ':': '.',
    _: '-',
    '*': '+',
    '>': '<',
  },
  'es-LA': {
    '!': '1',
    '"': '2',
    '#': '3',
    $: '4',
    '%': '5',
    '&': '6',
    '/': '7',
    '(': '8',
    ')': '9',
    '=': '0',
    '?': "'",
    '¡': '¿',
    ';': ',',
    ':': '.',
    _: '-',
    '*': '+',
    '>': '<',
    '[': '{',
    ']': '}',
  },
  'en-US': {
    '!': '1',
    '@': '2',
    '#': '3',
    $: '4',
    '%': '5',
    '^': '6',
    '&': '7',
    '*': '8',
    '(': '9',
    ')': '0',
    _: '-',
    '+': '=',
    ':': ';',
    '"': "'",
    '<': ',',
    '>': '.',
    '?': '/',
    '{': '[',
    '}': ']',
  },
};

/**
 * Tecla física de un carácter: minúsculas, tildes sobre su vocal (la tecla muerta se cuenta
 * aparte cuando aparece), signos con Shift sobre su tecla base. `null` si no está en el teclado.
 */
export function keyFor(char: string, layout: KeyboardLayout): string | null {
  const keys = new Set(KEYBOARD_ROWS[layout].flat());
  const lower = char.toLowerCase();
  if (keys.has(lower)) return lower;
  const shifted = SHIFTED[layout][char];
  if (shifted) return shifted;
  const base = lower.normalize('NFD').replace(/\p{M}/gu, '');
  return keys.has(base) ? base : null;
}

export interface KeyHeat {
  readonly attempts: number;
  readonly errors: number;
  /** Errores por intento, 0–1. */
  readonly rate: number;
}

/** Suma las estadísticas por carácter en cada tecla física. */
export function heatByKey(
  stats: readonly CharStatEntry[],
  layout: KeyboardLayout,
): Map<string, KeyHeat> {
  const totals = new Map<string, { attempts: number; errors: number }>();
  for (const stat of stats) {
    const key = keyFor(stat.key, layout);
    if (key === null) continue;
    const total = totals.get(key) ?? { attempts: 0, errors: 0 };
    total.attempts += stat.attempts;
    total.errors += stat.errors;
    totals.set(key, total);
  }
  return new Map(
    [...totals].map(([key, total]) => [
      key,
      { ...total, rate: total.attempts === 0 ? 0 : total.errors / total.attempts },
    ]),
  );
}
