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
  progressTimeline,
  totalChars,
  wpmFrom,
  type CharStat,
  type LiveMetrics,
  type ProgressTimeline,
  type RaceMetrics,
  type SecondSample,
} from './metrics/metrics.js';

export {
  BOT_LEVEL_IDS,
  BOT_LEVELS,
  BOT_NAMES,
  type BotLevel,
  type BotLevelSpec,
} from './bots/levels.js';
export {
  botCorrectCharsAt,
  botProgressAt,
  botWpmAt,
  createBotProfile,
  createBots,
  simulateBot,
  type BotProfile,
  type BotRun,
  type BotSample,
  type CreateBotOptions,
  type CreateBotsOptions,
  type SimulateBotOptions,
} from './bots/bot.js';
export { rankRunners, type RunnerResult, type Standing } from './bots/standings.js';
export { decodeKeystrokes, encodeKeystrokes, type EncodedKeystrokes } from './typing/codec.js';
export { playKeystrokes, type KeystrokeInput } from './typing/replay.js';
export {
  inspectRun,
  MAX_PLAUSIBLE_PEAK_WPM,
  MAX_PLAUSIBLE_WPM,
  MIN_INTERVAL_VARIATION,
  type CheatReason,
  type CheatReport,
} from './anticheat/anticheat.js';
