/**
 * Números pseudoaleatorios deterministas. Cada carrera recibe una semilla para que
 * los bots y los textos generados se puedan reproducir exactamente en tests y repeticiones.
 */

/** Devuelve un número uniforme en [0, 1). */
export type Rng = () => number;

/** Generador mulberry32: 32 bits de estado, rápido y suficiente para simulación (no criptográfico). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convierte un texto (p. ej. id de carrera o fecha) en una semilla de 32 bits con FNV-1a. */
export function seedFromString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Entero uniforme en [min, max], ambos incluidos. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`Rango inválido: [${min}, ${max}]`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/** Muestra de una normal N(mean, stdDev²) con Box-Muller. */
export function randomNormal(rng: Rng, mean: number, stdDev: number): number {
  // 1 - rng() está en (0, 1], así el logaritmo nunca recibe 0.
  const u1 = 1 - rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Muestra de una log-normal parametrizada por su mediana y la desviación `sigma` del logaritmo.
 * Modela bien los tiempos entre pulsaciones: siempre positivos y con cola larga a la derecha.
 */
export function randomLogNormal(rng: Rng, median: number, sigma: number): number {
  if (median <= 0) throw new RangeError('La mediana debe ser positiva');
  return Math.exp(randomNormal(rng, Math.log(median), sigma));
}
