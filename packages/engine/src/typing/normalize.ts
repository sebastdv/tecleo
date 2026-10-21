/**
 * Normalización de textos fuente y de lo que escribe el usuario. Ambos pasan por el mismo
 * mapa, así un “ tipográfico en el texto se escribe con " y viceversa.
 */

const TYPOGRAPHIC: Readonly<Record<string, string>> = {
  '“': '"', // “
  '”': '"', // ”
  '„': '"', // „
  '«': '"', // «
  '»': '"', // »
  '‘': "'", // ‘
  '’': "'", // ’
  '‚': "'", // ‚
  '′': "'", // ′
  '‐': '-', // ‐
  '‑': '-', // ‑
  '‒': '-', // ‒
  '–': '-', // –
  '—': '-', // —
  '―': '-', // ―
  '−': '-', // −
  '…': '...', // …
  ' ': ' ', // espacio duro
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
};

const TYPOGRAPHIC_PATTERN = new RegExp(`[${Object.keys(TYPOGRAPHIC).join('')}]`, 'gu');

/** NFC + caracteres tipográficos a su equivalente de teclado. */
export function normalizeChars(value: string): string {
  return value.normalize('NFC').replace(TYPOGRAPHIC_PATTERN, (ch) => TYPOGRAPHIC[ch] ?? ch);
}

export interface NormalizeTextOptions {
  /**
   * `true` para código: conserva saltos de línea y la sangría inicial de cada línea.
   * `false` (prosa): todo espacio en blanco se convierte en un solo espacio.
   */
  preserveLines?: boolean;
}

/** Deja el texto listo para escribirse: sin espacios dobles, sin líneas vacías, sin bordes. */
export function normalizeText(
  text: string,
  { preserveLines = false }: NormalizeTextOptions = {},
): string {
  const chars = normalizeChars(text).replace(/\r\n?/g, '\n').replace(/\t/g, '  ');
  if (!preserveLines) return chars.replace(/\s+/g, ' ').trim();

  return chars
    .split('\n')
    .map((line) => {
      const indent = /^ */.exec(line)?.[0] ?? '';
      return indent + line.slice(indent.length).replace(/\s+/g, ' ').trimEnd();
    })
    .filter((line) => line.trim() !== '')
    .join('\n')
    .replace(/^ +/, '');
}

const accentCache = new Map<string, string>();

/** Quita tildes, diéresis y la virgulilla de la ñ: á→a, ü→u, ñ→n. */
export function stripAccents(ch: string): string {
  let base = accentCache.get(ch);
  if (base === undefined) {
    base = ch.normalize('NFD').replace(/\p{M}/gu, '');
    accentCache.set(ch, base);
  }
  return base;
}
