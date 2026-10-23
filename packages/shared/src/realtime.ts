import { z } from 'zod';

import { AVATARS } from './auth.js';
import { progressUpdateSchema } from './progression.js';
import { encodedKeystrokesSchema } from './results.js';
import { BOT_LEVELS, LANGUAGES } from './settings.js';

/**
 * Contrato de eventos de Socket.IO (spec 7.2). Todo lo que entra al servidor se valida con
 * estos esquemas; lo que sale, el cliente lo valida igual antes de usarlo.
 */

/** Código de sala privada: 6 caracteres sin los que se confunden (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(ROOM_CODE_PATTERN));

export const ROOM_PHASES = ['waiting', 'countdown', 'racing', 'finished'] as const;
export type RoomPhase = (typeof ROOM_PHASES)[number];

export const roomConfigSchema = z.object({
  language: z.enum(LANGUAGES),
  length: z.enum(['any', 'short', 'medium', 'long']),
  botCount: z.number().int().min(0).max(5),
  botLevel: z.enum([...BOT_LEVELS, 'mixed']),
  maxPlayers: z.number().int().min(2).max(10),
});
export type RoomConfig = z.infer<typeof roomConfigSchema>;

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  language: 'es',
  length: 'any',
  botCount: 0,
  botLevel: 'intermediate',
  maxPlayers: 5,
};

// ── Cliente → servidor ────────────────────────────────────────────────────────────────────

export const roomCreateSchema = z.object({ config: roomConfigSchema });
export const roomJoinSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('private'), code: roomCodeSchema }),
  /** Matchmaking: entra a una sala pública abierta del idioma o crea una. */
  z.object({ mode: z.literal('public'), language: z.enum(LANGUAGES) }),
]);
export const roomReadySchema = z.object({ ready: z.boolean() });
export const roomConfigUpdateSchema = z.object({ config: roomConfigSchema });

export const raceProgressSchema = z.object({
  /** Caracteres correctos hasta ahora (lo que avanza en la pista). */
  charIndex: z.number().int().min(0).max(20_000),
  errors: z.number().int().min(0).max(20_000),
  wpm: z.number().min(0).max(1_000),
  /** `Date.now()` del cliente, para diagnóstico de latencia. */
  clientTime: z.number(),
});
export type RaceProgressInput = z.infer<typeof raceProgressSchema>;

export const raceFinishSchema = z.object({ keystrokes: encodedKeystrokesSchema });
export const timePingSchema = z.object({ clientTime: z.number() });

// ── Servidor → cliente ────────────────────────────────────────────────────────────────────

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.enum(AVATARS).nullable(),
  /** Tiene cuenta (su resultado se guarda en su perfil). */
  registered: z.boolean(),
  ready: z.boolean(),
  connected: z.boolean(),
  /** Fracción del texto correcta, 0–1. */
  progress: z.number(),
  wpm: z.number(),
  /** Ms desde la salida en que terminó; `null` si no terminó. */
  finishMs: z.number().nullable(),
  position: z.number().int().nullable(),
  dnf: z.boolean(),
});
export type RoomPlayer = z.infer<typeof playerSchema>;

export const roomBotsSchema = z.object({
  seed: z.number().int(),
  levels: z.array(z.enum(BOT_LEVELS)),
});

export const roomStateSchema = z.object({
  code: z.string(),
  mode: z.enum(['public', 'private']),
  phase: z.enum(ROOM_PHASES),
  hostId: z.string().nullable(),
  config: roomConfigSchema,
  players: z.array(playerSchema),
  /** Bots de la carrera: cada cliente los regenera idénticos con el motor. */
  bots: roomBotsSchema.nullable(),
  /** Hora del servidor (epoch ms) en que termina la espera del matchmaking. */
  waitingEndsAt: z.number().nullable(),
  /** Hora del servidor (epoch ms) de la salida. */
  startAt: z.number().nullable(),
  race: z
    .object({
      id: z.string(),
      textId: z.string(),
      text: z.string(),
      author: z.string().nullable(),
      source: z.string().nullable(),
      timeLimitMs: z.number().int(),
    })
    .nullable(),
});
export type RoomState = z.infer<typeof roomStateSchema>;

export const raceProgressBroadcastSchema = z.object({
  players: z.array(z.object({ id: z.string(), progress: z.number(), wpm: z.number() })),
  /** Hora del servidor del envío: el cliente interpola las posiciones a partir de ella. */
  serverTime: z.number(),
});

export const raceResultsSchema = z.object({
  standings: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isBot: z.boolean(),
      position: z.number().int(),
      wpm: z.number(),
      accuracy: z.number().nullable(),
      finishMs: z.number().nullable(),
      flagged: z.boolean(),
    }),
  ),
  /** Id del resultado guardado de quien recibe el evento (si tiene cuenta). */
  savedResultId: z.string().nullable(),
  /** XP, nivel y logros que sumó quien recibe el evento (si tiene cuenta). */
  progress: progressUpdateSchema.nullable().default(null),
});
export type RaceResults = z.infer<typeof raceResultsSchema>;

export const timePongSchema = z.object({ clientTime: z.number(), serverTime: z.number() });

export const REALTIME_ERROR_CODES = [
  'VALIDATION',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_CLOSED',
  'NOT_HOST',
  'NOT_IN_ROOM',
  'RATE_LIMITED',
  'INVALID_RUN',
] as const;
export const realtimeErrorSchema = z.object({
  code: z.enum(REALTIME_ERROR_CODES),
  message: z.string(),
});
export type RealtimeError = z.infer<typeof realtimeErrorSchema>;

/** Nombres de los eventos, para no escribirlos a mano en cliente y servidor. */
export const EVENTS = {
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  roomReady: 'room:ready',
  roomConfig: 'room:config',
  roomStart: 'room:start',
  roomRematch: 'room:rematch',
  roomState: 'room:state',
  raceCountdown: 'race:countdown',
  raceStart: 'race:start',
  raceProgress: 'race:progress',
  raceFinish: 'race:finish',
  racePlayerFinished: 'race:player-finished',
  raceResults: 'race:results',
  timePing: 'time:ping',
  timePong: 'time:pong',
  error: 'error',
} as const;

// ── Sincronización de reloj (spec 7.3) ────────────────────────────────────────────────────

export interface ClockSample {
  /** `Date.now()` del cliente al enviar el ping. */
  readonly sent: number;
  /** Hora del servidor en la respuesta. */
  readonly server: number;
  /** `Date.now()` del cliente al recibir la respuesta. */
  readonly received: number;
}

export interface ClockEstimate {
  /** Sumar a la hora local para obtener la del servidor. */
  readonly offset: number;
  readonly rtt: number;
}

/**
 * Estima el desfase con el servidor estilo NTP: de varias muestras se usa la de menor ida y
 * vuelta, que es la que menos error tiene; el servidor respondió a mitad de camino.
 */
export function estimateClock(samples: readonly ClockSample[]): ClockEstimate {
  let best: ClockEstimate | null = null;
  for (const sample of samples) {
    const rtt = sample.received - sample.sent;
    if (rtt < 0) continue;
    const offset = sample.server - (sample.sent + rtt / 2);
    if (!best || rtt < best.rtt) best = { offset, rtt };
  }
  if (!best) throw new Error('No hay muestras válidas de reloj');
  return best;
}
