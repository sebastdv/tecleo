import { correctChars, totalChars, wpmFrom } from '../metrics/metrics.js';
import { createRng, randomInt, randomLogNormal, randomNormal, type Rng } from '../rng/rng.js';
import { stripAccents } from '../typing/normalize.js';
import { applyInput, createTypingState, start } from '../typing/state.js';
import type { Keystroke, TypingAction, TypingState } from '../typing/types.js';
import { BOT_LEVELS, BOT_NAMES, type BotLevel } from './levels.js';

export interface BotProfile {
  readonly id: string;
  readonly name: string;
  readonly level: BotLevel;
  /** ppm neto con el que va a terminar (muestreado dentro del rango del nivel). */
  readonly targetWpm: number;
  /** Ritmo a lo largo del texto: se cansa (más lento al final) o acelera en el cierre. */
  readonly finish: 'fatigue' | 'sprint' | 'steady';
}

/** Punto de la evolución de un bot: tras cada pulsación, cuántos caracteres lleva bien. */
export interface BotSample {
  readonly t: number;
  readonly correctChars: number;
}

export interface BotRun {
  readonly profile: BotProfile;
  /** Registro completo, con `t` en ms desde la señal de salida. Mismo formato que una persona. */
  readonly keystrokes: readonly Keystroke[];
  readonly samples: readonly BotSample[];
  readonly totalChars: number;
  /** Momento en que escribe el último carácter. */
  readonly finishMs: number;
}

export interface CreateBotOptions {
  readonly level: BotLevel;
  readonly seed: number;
  readonly index?: number;
  readonly name?: string;
}

export function createBotProfile({ level, seed, index = 0, name }: CreateBotOptions): BotProfile {
  const rng = createRng(seed);
  const spec = BOT_LEVELS[level];
  const center = (spec.minWpm + spec.maxWpm) / 2;
  const spread = (spec.maxWpm - spec.minWpm) / 4;
  const targetWpm = Math.min(spec.maxWpm, Math.max(spec.minWpm, randomNormal(rng, center, spread)));
  const roll = rng();
  return {
    id: `bot-${index}`,
    name: name ?? BOT_NAMES[randomInt(rng, 0, BOT_NAMES.length - 1)] ?? 'Bot',
    level,
    targetWpm,
    finish: roll < 0.4 ? 'fatigue' : roll < 0.7 ? 'sprint' : 'steady',
  };
}

/** Teclas vecinas en QWERTY: los errores humanos suelen caer al lado de la tecla buscada. */
const NEIGHBORS: Readonly<Record<string, string>> = {
  q: 'wa',
  w: 'qes',
  e: 'wrd',
  r: 'etf',
  t: 'ryg',
  y: 'tuh',
  u: 'yij',
  i: 'uok',
  o: 'ipl',
  p: 'oñl',
  a: 'qsz',
  s: 'adw',
  d: 'sfe',
  f: 'dgr',
  g: 'fht',
  h: 'gjy',
  j: 'hku',
  k: 'jli',
  l: 'kño',
  ñ: 'lp',
  z: 'xa',
  x: 'zcs',
  c: 'xvd',
  v: 'cbf',
  b: 'vng',
  n: 'bmh',
  m: 'nj',
};

function wrongCharFor(expected: string, rng: Rng): string {
  const base = stripAccents(expected);
  // Con tildes, el error típico es olvidarla.
  if (base !== expected && rng() < 0.6) return base;
  const lower = base.toLowerCase();
  const pool = NEIGHBORS[lower] ?? 'asdfjklñ';
  const pick = pool.charAt(randomInt(rng, 0, pool.length - 1)) || 'x';
  const wrong = base !== lower ? pick.toUpperCase() : pick;
  return wrong === expected ? 'x' : wrong;
}

const PUNCTUATION = /[.,;:!?¿¡]/;
const SLOW_CHAR = /[^a-zñ ]/;

interface PlannedAction {
  readonly units: number;
  readonly action: TypingAction;
}

/**
 * Planifica las pulsaciones del bot en "unidades" (1 = un carácter a ritmo medio). Después se
 * escalan para que el ppm neto final sea exactamente el objetivo.
 */
function plan(state: TypingState, profile: BotProfile, rng: Rng): PlannedAction[] {
  const spec = BOT_LEVELS[profile.level];
  const actions: PlannedAction[] = [];
  const total = state.words.length;
  // Reacción a la señal de salida.
  let pendingPause = randomLogNormal(rng, 3.5, 0.25);
  let previous = '';

  state.words.forEach((word, wordIndex) => {
    const sequence = word.target + word.separator.charAt(0);
    const shortWord = word.target.length <= 4;
    const progress = wordIndex / total;
    let pace = 1;
    if (profile.finish === 'fatigue') pace = 1 + 0.15 * progress;
    else if (profile.finish === 'sprint' && progress > 0.8) pace = 0.85;

    for (let i = 0; i < sequence.length; i++) {
      const ch = sequence.charAt(i);
      let median = pace;
      if (i === 0)
        median *= 1.3; // arrancar una palabra cuesta más
      else if (shortWord) median *= 0.8; // ráfaga en palabras cortas y frecuentes
      if (PUNCTUATION.test(previous)) median *= 2.5; // pausa tras puntuación
      if (SLOW_CHAR.test(ch.toLowerCase())) median *= 1.4; // mayúsculas, tildes, símbolos
      if (ch === '\n') median *= 1.8;
      const delay = pendingPause + randomLogNormal(rng, median, spec.rhythmSigma);
      pendingPause = 0;

      const isSeparator = i === word.target.length;
      if (!isSeparator && rng() < spec.errorRate) {
        // Se equivoca, sigue unas letras sin darse cuenta, se detiene, borra y reescribe.
        actions.push({ units: delay, action: { type: 'insert', text: wrongCharFor(ch, rng) } });
        const remaining = word.target.length - i - 1;
        const unnoticed = randomInt(rng, 0, Math.min(spec.maxCharsBeforeNoticing, remaining));
        for (let k = 1; k <= unnoticed; k++) {
          actions.push({
            units: randomLogNormal(rng, pace, spec.rhythmSigma),
            action: { type: 'insert', text: word.target.charAt(i + k) },
          });
        }
        const reaction = randomLogNormal(rng, 3, 0.3);
        for (let k = 0; k <= unnoticed; k++) {
          actions.push({
            units: (k === 0 ? reaction : 0) + randomLogNormal(rng, 0.7, 0.2),
            action: { type: 'deleteBackward' },
          });
        }
        actions.push({
          units: randomLogNormal(rng, pace * 1.2, spec.rhythmSigma),
          action: { type: 'insert', text: ch },
        });
      } else {
        actions.push({ units: delay, action: { type: 'insert', text: ch } });
      }
      previous = ch;
    }
  });
  return actions;
}

export interface SimulateBotOptions {
  readonly text: string;
  readonly preserveLines?: boolean;
  readonly profile: BotProfile;
  readonly seed: number;
}

/**
 * Simula a un bot escribiendo `text` en modo estricto. Es determinista: la misma semilla
 * produce exactamente las mismas pulsaciones (en el cliente y en el servidor).
 */
export function simulateBot({
  text,
  preserveLines = false,
  profile,
  seed,
}: SimulateBotOptions): BotRun {
  const rng = createRng(seed);
  const template = createTypingState({
    text,
    preserveLines,
    startOn: 'signal',
    rules: { mode: 'strict' },
  });
  const actions = plan(template, profile, rng);
  const chars = totalChars(template);
  const targetMs = (chars / 5 / profile.targetWpm) * 60_000;
  const units = actions.reduce((sum, item) => sum + item.units, 0);
  const scale = targetMs / units;

  let state = start(template, 0);
  let elapsed = 0;
  const samples: BotSample[] = [{ t: 0, correctChars: 0 }];
  for (const item of actions) {
    elapsed += item.units * scale;
    state = applyInput(state, item.action, elapsed);
    const last = state.keystrokes.at(-1);
    if (last) samples.push({ t: last.t, correctChars: correctChars(state) });
    if (state.phase === 'finished') break;
  }
  if (state.phase !== 'finished' || state.finishedAt === null) {
    throw new Error(`El bot ${profile.name} no terminó el texto`);
  }
  return {
    profile,
    keystrokes: state.keystrokes,
    samples,
    totalChars: chars,
    finishMs: state.finishedAt,
  };
}

/** Caracteres correctos del bot en el instante `t` (ms desde la salida). */
export function botCorrectCharsAt(run: BotRun, t: number): number {
  const { samples } = run;
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((samples[mid]?.t ?? 0) <= t) low = mid;
    else high = mid - 1;
  }
  return samples[low]?.correctChars ?? 0;
}

export function botProgressAt(run: BotRun, t: number): number {
  return run.totalChars === 0 ? 0 : botCorrectCharsAt(run, t) / run.totalChars;
}

/** ppm neto del bot hasta `t` (o el final si ya terminó). */
export function botWpmAt(run: BotRun, t: number): number {
  const elapsed = Math.min(t, run.finishMs);
  return elapsed < 1_000 ? 0 : wpmFrom(botCorrectCharsAt(run, elapsed), elapsed);
}

export interface CreateBotsOptions {
  readonly text: string;
  readonly preserveLines?: boolean;
  readonly levels: readonly BotLevel[];
  readonly seed: number;
}

/** Los bots de una carrera, con nombres distintos y una semilla derivada para cada uno. */
export function createBots({ text, preserveLines, levels, seed }: CreateBotsOptions): BotRun[] {
  const rng = createRng(seed);
  const names = [...BOT_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [names[i], names[j]] = [names[j] ?? '', names[i] ?? ''];
  }
  return levels.map((level, index) => {
    const botSeed = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    const profile = createBotProfile({
      level,
      seed: botSeed,
      index,
      name: names[index % names.length] ?? `Bot ${index + 1}`,
    });
    return simulateBot({
      text,
      profile,
      seed: botSeed ^ 0x5bd1e995,
      ...(preserveLines !== undefined && { preserveLines }),
    });
  });
}
