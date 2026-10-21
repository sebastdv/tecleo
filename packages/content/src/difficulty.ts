/**
 * Dificultad de un texto entre 0 y 100, combinando lo que más frena al escribir:
 * palabras largas, símbolos, mayúsculas, tildes y pares de letras poco frecuentes en el idioma.
 *
 * Sin imports relativos: el script de build lo carga directamente con Node.
 */

export type BigramFrequencies = ReadonlyMap<string, number>;

const LETTER = /\p{L}/u;

/** Frecuencia relativa (0–1) de cada par de letras consecutivas dentro de las palabras. */
export function bigramFrequencies(texts: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  let total = 0;
  for (const text of texts) {
    for (const word of text.toLowerCase().split(/[^\p{L}]+/u)) {
      for (let i = 1; i < word.length; i++) {
        const bigram = word.slice(i - 1, i + 1);
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
        total++;
      }
    }
  }
  const frequencies = new Map<string, number>();
  for (const [bigram, count] of counts) frequencies.set(bigram, count / total);
  return frequencies;
}

/** Un par es raro si aparece menos de una vez cada 2 000 pares. */
const RARE_BIGRAM = 1 / 2_000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function textDifficulty(text: string, bigrams: BigramFrequencies): number {
  const words = text.split(/\s+/).filter(Boolean);
  // Por puntos de código: el texto ya viene en NFC, así "á" es un solo carácter.
  const chars = Array.from(text.replace(/\s+/g, ''));
  if (words.length === 0 || chars.length === 0) return 0;

  const letters = chars.filter((ch) => LETTER.test(ch));
  const averageWordLength = letters.length / words.length;
  const symbolRatio = (chars.length - letters.length) / chars.length;
  const upperRatio = letters.filter((ch) => ch !== ch.toLowerCase()).length / letters.length;
  const accentRatio =
    letters.filter((ch) => ch.normalize('NFD').length > 1).length / letters.length;

  let pairs = 0;
  let rare = 0;
  for (const word of text.toLowerCase().split(/[^\p{L}]+/u)) {
    for (let i = 1; i < word.length; i++) {
      pairs++;
      if ((bigrams.get(word.slice(i - 1, i + 1)) ?? 0) < RARE_BIGRAM) rare++;
    }
  }
  const rareRatio = pairs === 0 ? 0 : rare / pairs;

  const score =
    0.35 * clamp01((averageWordLength - 3.5) / 3.5) +
    0.2 * clamp01(symbolRatio / 0.12) +
    0.15 * clamp01(upperRatio / 0.08) +
    0.1 * clamp01(accentRatio / 0.06) +
    0.2 * clamp01(rareRatio / 0.15);
  return Math.round(score * 100);
}
