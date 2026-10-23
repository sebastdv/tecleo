'use client';

import {
  analyze,
  applyInput,
  beginCountdown,
  correctChars,
  createBots,
  createTypingState,
  encodeKeystrokes,
  keystrokeToAction,
  liveMetrics,
  start,
  tick,
  totalChars,
  type BotRun,
  type KeystrokeInput,
  type RaceMetrics,
  type TypingAction,
  type TypingState,
} from '@tecleo/engine';
import {
  EVENTS,
  raceProgressBroadcastSchema,
  raceResultsSchema,
  realtimeErrorSchema,
  roomStateSchema,
  type RaceResults,
  type RealtimeError,
  type RoomConfig,
  type RoomState,
} from '@tecleo/shared';
import type { Socket } from 'socket.io-client';
import { z } from 'zod';
import { create } from 'zustand';

import { useAuthStore } from '@/auth/auth-store';
import { connectRealtime, getSocket, selfId, serverToLocal } from '@/lib/realtime';

import { pushSample, type ProgressSample } from './snapshots';

/** Cada cuánto se manda el progreso propio (spec 7.3: ~100–150 ms). */
const PROGRESS_THROTTLE_MS = 120;
const RUN_KEY_PREFIX = 'tecleo-run:';

export type RoomTarget =
  | { readonly mode: 'private'; readonly code: string }
  | { readonly mode: 'public'; readonly language: RoomConfig['language'] };

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type FinishStatus = 'idle' | 'sending' | 'sent' | 'rejected';

const ackSchema = z.union([
  z.object({ ok: z.literal(true), code: z.string().optional() }),
  z.object({ ok: z.literal(false), error: realtimeErrorSchema }),
]);
const playerFinishedSchema = z.object({
  playerId: z.string(),
  position: z.number().int(),
  wpm: z.number(),
});

interface RoomStore {
  readonly connection: ConnectionStatus;
  readonly error: RealtimeError | null;
  readonly room: RoomState | null;
  readonly selfId: string | null;
  /** Carrera local de quien juega: se arma cuando el servidor anuncia la cuenta regresiva. */
  readonly raceId: string | null;
  readonly typing: TypingState | null;
  readonly bots: readonly BotRun[];
  /** Salida en el reloj de `performance.now()` de esta página. */
  readonly startAt: number | null;
  /** ppm de los rivales humanos según el último envío del servidor. */
  readonly liveWpm: Readonly<Record<string, number>>;
  /** Puestos de quienes ya llegaron, mientras sigue la carrera. */
  readonly arrivals: Readonly<Record<string, number>>;
  readonly metrics: RaceMetrics | null;
  readonly results: RaceResults | null;
  readonly finish: FinishStatus;
  enter: (target: RoomTarget) => Promise<void>;
  leave: () => void;
  setReady: (ready: boolean) => Promise<void>;
  updateConfig: (config: RoomConfig) => Promise<void>;
  startNow: () => Promise<void>;
  rematch: () => Promise<void>;
  input: (action: TypingAction, timestamp: number) => void;
  tick: (now: number) => void;
  dismissError: () => void;
}

/** Muestras de progreso de los rivales (fuera de React: la pista las lee cuadro a cuadro). */
const samples = new Map<string, ProgressSample[]>();
export function rivalSamples(id: string): readonly ProgressSample[] {
  return samples.get(id) ?? [];
}

let lastProgressAt = 0;
let progressTimer: ReturnType<typeof setTimeout> | undefined;
let pendingLeave: ReturnType<typeof setTimeout> | undefined;
let bound = false;

const blankRace = {
  raceId: null,
  typing: null,
  bots: [],
  startAt: null,
  liveWpm: {},
  arrivals: {},
  metrics: null,
  results: null,
  finish: 'idle' as FinishStatus,
};

// ── Pulsaciones en sessionStorage: recargar la página no pierde lo escrito ────────────────

function storedRun(raceId: string): KeystrokeInput[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(RUN_KEY_PREFIX + raceId) ?? '[]');
    return z
      .array(z.tuple([z.number(), z.string()]))
      .parse(raw)
      .map(([t, input]) => ({ t, input }));
  } catch {
    return [];
  }
}

function storeRun(raceId: string, typing: TypingState): void {
  try {
    sessionStorage.setItem(
      RUN_KEY_PREFIX + raceId,
      JSON.stringify(typing.keystrokes.map((keystroke) => [keystroke.t, keystroke.input])),
    );
  } catch {
    // Sin almacenamiento, una recarga empieza la carrera desde cero.
  }
}

function forgetOtherRuns(raceId: string | null): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(RUN_KEY_PREFIX) && key !== RUN_KEY_PREFIX + (raceId ?? '')) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Nada que limpiar.
  }
}

/** Las carreras en línea son estrictas y sin ignorar tildes: todos con las mismas reglas. */
function raceTemplate(race: NonNullable<RoomState['race']>): TypingState {
  return createTypingState({
    text: race.text,
    startOn: 'signal',
    timeLimitMs: race.timeLimitMs,
    rules: { mode: 'strict' },
  });
}

async function emitAck(event: string, body: object): Promise<z.output<typeof ackSchema>> {
  const socket = await connectRealtime();
  const parsed = ackSchema.safeParse(await socket.timeout(10_000).emitWithAck(event, body));
  if (!parsed.success) throw new Error('Respuesta inesperada del servidor');
  return parsed.data;
}

export const useRoomStore = create<RoomStore>()((set, get) => {
  const fail = (error: RealtimeError) => {
    set({ error });
  };

  /** Arma (o rearma) la carrera local a partir del estado del servidor. */
  const syncRace = (state: RoomState) => {
    const { race } = state;
    if (state.phase === 'waiting' || !race) {
      if (get().raceId !== null) {
        samples.clear();
        set(blankRace);
      }
      return;
    }
    const startAt = state.startAt === null ? null : serverToLocal(state.startAt);
    const current = get();
    if (current.raceId === race.id) {
      const { typing } = current;
      if (typing?.phase === 'countdown' && state.bots) {
        // La cuenta regresiva se reinicia si entra alguien, y en las públicas cambia un bot.
        const levels = current.bots.map((bot) => bot.profile.level).join();
        set({
          startAt,
          ...(state.bots.levels.join() !== levels && {
            bots: createBots({ text: race.text, levels: state.bots.levels, seed: state.bots.seed }),
          }),
        });
      } else if (state.phase === 'finished' && typing?.phase === 'running') {
        // El servidor cerró la carrera (límite de tiempo): la local se cierra con ella.
        const closed = tick(typing, Number.POSITIVE_INFINITY);
        set({ typing: closed, metrics: analyze(closed) });
      }
      return;
    }

    forgetOtherRuns(race.id);
    samples.clear();
    let typing = beginCountdown(raceTemplate(race));
    const bots = state.bots
      ? createBots({ text: race.text, levels: state.bots.levels, seed: state.bots.seed })
      : [];
    // Volver a una carrera en curso (recarga o corte): se reproducen las pulsaciones guardadas.
    if (state.phase !== 'countdown' && startAt !== null) {
      typing = start(typing, startAt);
      for (const keystroke of storedRun(race.id)) {
        typing = applyInput(typing, keystrokeToAction(keystroke), startAt + keystroke.t);
        if (typing.phase === 'finished') break;
      }
      if (state.phase === 'finished' && typing.phase === 'running') {
        typing = tick(typing, Number.POSITIVE_INFINITY);
      }
    }
    const self = state.players.find((player) => player.id === get().selfId);
    set({
      ...blankRace,
      raceId: race.id,
      typing,
      bots,
      startAt,
      finish: self?.finishMs != null ? 'sent' : 'idle',
    });
    if (typing.phase === 'running') get().tick(performance.now());
  };

  const sendProgress = (socket: Socket) => {
    const { typing, raceId } = get();
    if (!typing || !raceId) return;
    lastProgressAt = performance.now();
    storeRun(raceId, typing);
    if (typing.phase !== 'running') return;
    socket.emit(EVENTS.raceProgress, {
      charIndex: correctChars(typing),
      errors: typing.keystrokes.filter((keystroke) => !keystroke.correct).length,
      wpm: Math.min(1_000, liveMetrics(typing, performance.now()).wpm),
      clientTime: Date.now(),
    });
  };

  /** Progreso con throttling: como mucho uno cada ~120 ms, y el último siempre sale. */
  const scheduleProgress = () => {
    const socket = getSocket();
    const wait = PROGRESS_THROTTLE_MS - (performance.now() - lastProgressAt);
    if (wait <= 0) {
      clearTimeout(progressTimer);
      progressTimer = undefined;
      sendProgress(socket);
    } else {
      progressTimer ??= setTimeout(() => {
        progressTimer = undefined;
        sendProgress(socket);
      }, wait);
    }
  };

  /** Al completar el texto, el servidor recibe las pulsaciones y decide el resultado. */
  const sendFinish = async (typing: TypingState) => {
    if (get().finish !== 'idle') return;
    set({ finish: 'sending' });
    const { raceId } = get();
    if (raceId) storeRun(raceId, typing);
    try {
      const ack = await emitAck(EVENTS.raceFinish, {
        keystrokes: encodeKeystrokes(typing.keystrokes),
      });
      if (ack.ok) set({ finish: 'sent' });
      else {
        set({ finish: 'rejected' });
        fail(ack.error);
      }
    } catch {
      set({ finish: 'idle' });
    }
  };

  const bind = (socket: Socket) => {
    if (bound) return;
    bound = true;
    socket.on('connect', () => {
      set({ connection: 'connected' });
      // Una llegada que no se pudo mandar durante el corte se manda al volver.
      const { typing, finish } = get();
      if (typing?.phase === 'finished' && finish === 'idle') get().tick(performance.now());
    });
    socket.on('disconnect', () => {
      if (get().connection === 'connected') set({ connection: 'reconnecting' });
    });
    socket.on(EVENTS.roomState, (raw: unknown) => {
      const state = roomStateSchema.safeParse(raw);
      if (!state.success) return;
      set({ room: state.data });
      syncRace(state.data);
    });
    socket.on(EVENTS.raceProgress, (raw: unknown) => {
      const snapshot = raceProgressBroadcastSchema.safeParse(raw);
      if (!snapshot.success) return;
      const at = performance.now();
      const liveWpm: Record<string, number> = {};
      for (const player of snapshot.data.players) {
        samples.set(
          player.id,
          pushSample(rivalSamples(player.id), { at, progress: player.progress }),
        );
        liveWpm[player.id] = player.wpm;
      }
      set({ liveWpm });
    });
    socket.on(EVENTS.racePlayerFinished, (raw: unknown) => {
      const arrival = playerFinishedSchema.safeParse(raw);
      if (!arrival.success) return;
      const { playerId, position } = arrival.data;
      samples.set(
        playerId,
        pushSample(rivalSamples(playerId), { at: performance.now(), progress: 1 }),
      );
      set({ arrivals: { ...get().arrivals, [playerId]: position } });
    });
    socket.on(EVENTS.raceResults, (raw: unknown) => {
      const results = raceResultsSchema.safeParse(raw);
      if (!results.success) return;
      const { typing } = get();
      // Si se acabó el tiempo antes de terminar, la carrera local se cierra igual.
      const closed = typing?.phase === 'running' ? tick(typing, Number.POSITIVE_INFINITY) : typing;
      // La XP y el nivel nuevos se ven en la sesión sin volver a pedirla.
      const { progress } = results.data;
      const { user, setUser } = useAuthStore.getState();
      if (user && progress) setUser({ ...user, xp: progress.xp, level: progress.level });
      set({
        results: results.data,
        typing: closed,
        metrics: closed?.phase === 'finished' ? analyze(closed) : get().metrics,
      });
    });
    socket.on(EVENTS.error, (raw: unknown) => {
      const error = realtimeErrorSchema.safeParse(raw);
      // Los límites de eventos no le dicen nada a la persona: el progreso se reenvía solo.
      if (error.success && error.data.code !== 'RATE_LIMITED') fail(error.data);
    });
  };

  const act = async (event: string, body: object = {}) => {
    try {
      const ack = await emitAck(event, body);
      if (!ack.ok) fail(ack.error);
    } catch {
      set({ connection: 'failed' });
    }
  };

  return {
    connection: 'idle',
    error: null,
    room: null,
    selfId: null,
    ...blankRace,

    enter: async (target) => {
      clearTimeout(pendingLeave);
      pendingLeave = undefined;
      const socket = getSocket();
      bind(socket);
      set({
        connection: socket.connected ? 'connected' : 'connecting',
        error: null,
        selfId: selfId(),
      });
      try {
        const ack = await emitAck(EVENTS.roomJoin, target);
        set({ connection: 'connected' });
        if (!ack.ok) {
          set({ room: null, ...blankRace });
          fail(ack.error);
        }
      } catch {
        set({ connection: 'failed' });
      }
    },

    leave: () => {
      // Al desmontar se sale con una pequeña espera: el doble montaje de desarrollo y volver
      // enseguida a la misma sala no deben sacar a nadie.
      clearTimeout(pendingLeave);
      pendingLeave = setTimeout(() => {
        pendingLeave = undefined;
        if (getSocket().connected) getSocket().emit(EVENTS.roomLeave, {});
        forgetOtherRuns(null);
        samples.clear();
        set({ room: null, error: null, ...blankRace });
      }, 300);
    },

    setReady: (ready) => act(EVENTS.roomReady, { ready }),
    updateConfig: (config) => act(EVENTS.roomConfig, { config }),
    startNow: () => act(EVENTS.roomStart),
    rematch: () => act(EVENTS.roomRematch),

    input: (action, timestamp) => {
      const { typing } = get();
      if (typing?.phase !== 'running') return;
      const next = applyInput(typing, action, timestamp);
      if (next === typing) return;
      set({ typing: next });
      scheduleProgress();
      if (next.phase === 'finished') get().tick(timestamp);
    },

    tick: (now) => {
      const { typing, startAt } = get();
      if (!typing || startAt === null) return;
      if (typing.phase === 'countdown') {
        if (now >= startAt) set({ typing: start(typing, startAt) });
        return;
      }
      const current = typing.phase === 'running' ? tick(typing, now) : typing;
      if (current.phase !== 'finished') return;
      if (current !== typing || !get().metrics) set({ typing: current, metrics: analyze(current) });
      // Sin completar el texto (se acabó el tiempo) no hay llegada: el servidor marca "no terminó".
      if (correctChars(current) === totalChars(current)) void sendFinish(current);
    },

    dismissError: () => {
      set({ error: null });
    },
  };
});

/** Crea una sala privada y devuelve su código; la página de la sala se une a ella después. */
export async function createRoom(config: RoomConfig): Promise<string | RealtimeError> {
  const ack = await emitAck(EVENTS.roomCreate, { config });
  if (!ack.ok) return ack.error;
  if (!ack.code) throw new Error('El servidor no devolvió el código de la sala');
  return ack.code;
}
