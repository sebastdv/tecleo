import type { BotRun, RaceMetrics, TypingState } from '@tecleo/engine';
import type { AvatarId, RoomConfig, RoomPhase } from '@tecleo/shared';

/** Quién juega: una cuenta o un invitado con un id estable que guarda su navegador. */
export interface Identity {
  /** `user:<uuid>` o `guest:<uuid>`: el mismo id al reconectarse. */
  readonly id: string;
  readonly userId: string | null;
  readonly name: string;
  readonly avatar: AvatarId | null;
}

export interface FinishedRun {
  readonly state: TypingState;
  readonly metrics: RaceMetrics;
  readonly flagReason: string | null;
}

export interface PlayerState {
  readonly identity: Identity;
  ready: boolean;
  connected: boolean;
  /** Hora del servidor en que se desconectó (para el margen de reconexión). */
  disconnectedAt: number | null;
  /** Caracteres correctos según el último progreso aceptado. */
  progressChars: number;
  /** Progreso que el servidor descartó por implausible: se marca al terminar. */
  progressFlag: string | null;
  run: FinishedRun | null;
  dnf: boolean;
  /** Abandonó en plena carrera: sigue en la clasificación como "no terminó". */
  left: boolean;
}

export interface RoomText {
  readonly id: string;
  readonly content: string;
  readonly author: string | null;
  readonly source: string | null;
}

export interface Room {
  readonly code: string;
  readonly mode: 'public' | 'private';
  phase: RoomPhase;
  hostId: string | null;
  config: RoomConfig;
  /** En orden de llegada (el orden de los carriles). */
  readonly players: Map<string, PlayerState>;
  text: RoomText;
  /** Id de la carrera actual (cambia con cada revancha). */
  raceId: string;
  seed: number;
  /** Bots de la carrera, ya simulados (se calculan al empezar la cuenta regresiva). */
  bots: BotRun[];
  waitingEndsAt: number | null;
  startAt: number | null;
  timeLimitMs: number;
  totalChars: number;
  lastBroadcastAt: number;
  /** Cuándo cerró la carrera (para limpiar salas viejas). */
  finishedAt: number | null;
}
