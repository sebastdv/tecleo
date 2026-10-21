export type BotLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'legend';

export const BOT_LEVEL_IDS: readonly BotLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'legend',
];

export interface BotLevelSpec {
  /** Rango de ppm neto en el que termina el bot. */
  readonly minWpm: number;
  readonly maxWpm: number;
  /** Probabilidad de equivocarse en cada carácter. */
  readonly errorRate: number;
  /** Dispersión (σ del logaritmo) del tiempo entre pulsaciones: más alta = ritmo más irregular. */
  readonly rhythmSigma: number;
  /** Cuántos caracteres puede seguir escribiendo antes de notar un error. */
  readonly maxCharsBeforeNoticing: number;
}

export const BOT_LEVELS: Readonly<Record<BotLevel, BotLevelSpec>> = {
  beginner: {
    minWpm: 25,
    maxWpm: 35,
    errorRate: 0.06,
    rhythmSigma: 0.45,
    maxCharsBeforeNoticing: 3,
  },
  intermediate: {
    minWpm: 45,
    maxWpm: 60,
    errorRate: 0.035,
    rhythmSigma: 0.38,
    maxCharsBeforeNoticing: 2,
  },
  advanced: {
    minWpm: 70,
    maxWpm: 90,
    errorRate: 0.022,
    rhythmSigma: 0.32,
    maxCharsBeforeNoticing: 2,
  },
  expert: {
    minWpm: 100,
    maxWpm: 120,
    errorRate: 0.012,
    rhythmSigma: 0.27,
    maxCharsBeforeNoticing: 1,
  },
  legend: {
    minWpm: 130,
    maxWpm: 160,
    errorRate: 0.007,
    rhythmSigma: 0.22,
    maxCharsBeforeNoticing: 1,
  },
};

/**
 * Nombres de los bots: tipógrafos e imprentas históricas, en línea con la identidad de
 * "tipos móviles". Se muestran siempre con el distintivo de bot.
 */
export const BOT_NAMES: readonly string[] = [
  'Garamond',
  'Bodoni',
  'Didot',
  'Caslon',
  'Baskerville',
  'Ibarra',
  'Jenson',
  'Manuzio',
  'Plantin',
  'Elzevir',
  'Fournier',
  'Gutenberg',
  'Estienne',
  'Granjon',
  'Fell',
  'Bembo',
];
