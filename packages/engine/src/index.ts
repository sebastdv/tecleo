export {
  createRng,
  randomInt,
  randomLogNormal,
  randomNormal,
  seedFromString,
  type Rng,
} from './rng/rng.js';

export {
  BACKSPACE,
  DEFAULT_RULES,
  DELETE_WORD,
  type CharState,
  type Keystroke,
  type Phase,
  type StartTrigger,
  type TypingAction,
  type TypingMode,
  type TypingRules,
  type TypingState,
  type WordState,
} from './typing/types.js';
export { normalizeChars, normalizeText, stripAccents } from './typing/normalize.js';
export { charsMatch, wordCharStates, wordMatches } from './typing/chars.js';
export {
  appendText,
  applyInput,
  beginCountdown,
  createTypingState,
  finish,
  start,
  stateText,
  tick,
  tokenize,
  type CreateTypingStateOptions,
} from './typing/state.js';
export { blankRun, keystrokeToAction, replayKeystrokes } from './typing/replay.js';
export {
  actionFromBeforeInput,
  actionFromCompositionEnd,
  type BeforeInputLike,
} from './typing/input-events.js';

export {
  accuracy,
  analyze,
  consistency,
  correctChars,
  elapsedMs,
  liveMetrics,
  missedChars,
  totalChars,
  wpmFrom,
  type CharStat,
  type LiveMetrics,
  type RaceMetrics,
  type SecondSample,
} from './metrics/metrics.js';
