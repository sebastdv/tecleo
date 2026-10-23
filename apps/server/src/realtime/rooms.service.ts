import { randomInt, randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  analyze,
  BOT_LEVEL_IDS,
  botProgressAt,
  correctChars,
  createBots,
  createRng,
  createTypingState,
  decodeKeystrokes,
  inspectRun,
  playKeystrokes,
  randomInt as seededInt,
  rankRunners,
  totalChars,
  wpmFrom,
  type BotLevel,
  type EncodedKeystrokes,
} from '@tecleo/engine';
import {
  ROOM_CODE_ALPHABET,
  type ProgressUpdate,
  type RaceProgressInput,
  type RaceResults,
  type RealtimeError,
  type RoomConfig,
  type RoomState,
} from '@tecleo/shared';
import type { z } from 'zod';
import type { roomJoinSchema } from '@tecleo/shared';

import { RoomStore } from './room-store.js';
import type { Identity, PlayerState, Room, RoomText } from './room.js';

export interface RoomTimings {
  /** Espera del matchmaking antes de completar con bots (spec: ~10 s). */
  readonly matchmakingWaitMs: number;
  /** Cuenta regresiva (spec: 5 s; se reinicia si entra alguien). */
  readonly countdownMs: number;
  /** Margen para volver a la carrera tras una desconexión (spec: ~30 s). */
  readonly reconnectGraceMs: number;
  /** Cada cuánto se envían las posiciones durante la carrera. */
  readonly broadcastMs: number;
  /** Cuánto vive una sala terminada sin nadie conectado. */
  readonly finishedTtlMs: number;
}

export const ROOM_TIMINGS = Symbol('ROOM_TIMINGS');
export const CLOCK = Symbol('CLOCK');
export type Clock = () => number;

/** Texto al azar para una carrera (base de datos en producción, fijo en los tests). */
export abstract class TextPicker {
  abstract pick(config: RoomConfig, excludeId?: string): Promise<RoomText>;
}

/** Lo guardado de un jugador con cuenta: su resultado y lo que sumó a su progresión. */
export interface SavedResult {
  readonly id: string;
  readonly progress: ProgressUpdate | null;
}

/** Resultados de la carrera tal como los recibe un jugador (con lo suyo guardado). */
export function resultsForPlayer(
  standings: RaceResults['standings'],
  saved: ReadonlyMap<string, SavedResult>,
  playerId: string,
): RaceResults {
  const own = saved.get(playerId);
  return { standings, savedResultId: own?.id ?? null, progress: own?.progress ?? null };
}

/** Guarda los resultados de quienes tienen cuenta; devuelve lo guardado por jugador. */
export abstract class RaceRecorder {
  abstract record(
    room: Room,
    standings: RaceResults['standings'],
  ): Promise<Map<string, SavedResult>>;
}

export type RoomEvent =
  | { readonly type: 'state'; readonly room: Room }
  | { readonly type: 'progress'; readonly room: Room }
  | {
      readonly type: 'playerFinished';
      readonly room: Room;
      readonly playerId: string;
      readonly position: number;
      readonly wpm: number;
    }
  | {
      readonly type: 'results';
      readonly room: Room;
      readonly standings: RaceResults['standings'];
      readonly saved: ReadonlyMap<string, SavedResult>;
    }
  | { readonly type: 'closed'; readonly room: Room };

export class RealtimeException extends Error {
  constructor(
    readonly code: RealtimeError['code'],
    message: string,
  ) {
    super(message);
  }
}

/** Corredores de una carrera pública: humanos más bots. */
const PUBLIC_RUNNERS = 5;
/** ppm a partir del cual el progreso en vivo es imposible (se recorta y se marca). */
const MAX_LIVE_WPM = 300;
/** Cuánto puede retroceder el progreso (borrados) sin considerarse incoherente. */
const PROGRESS_BACKTRACK = 30;
/** Latencia y desfase de reloj tolerados al comparar la llegada declarada con la real. */
const FINISH_TOLERANCE_MS = 2_000;
/** Límite de tiempo: el texto completo a 12 ppm, con un mínimo de un minuto. */
const MIN_WPM_FOR_LIMIT = 12;
/** Niveles de los bots que completan una carrera pública. */
const PUBLIC_BOT_LEVELS: readonly BotLevel[] = [
  'beginner',
  'intermediate',
  'intermediate',
  'advanced',
  'expert',
];

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  private listener: (event: RoomEvent) => void = () => undefined;
  /** Clasificación de las carreras terminadas, para el estado de la sala. */
  private readonly standings = new WeakMap<Room, RaceResults['standings']>();
  /** Ids de los resultados guardados por jugador, una vez que la base respondió. */
  private readonly saved = new WeakMap<Room, ReadonlyMap<string, SavedResult>>();

  constructor(
    private readonly store: RoomStore,
    private readonly picker: TextPicker,
    private readonly recorder: RaceRecorder,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ROOM_TIMINGS) private readonly timings: RoomTimings,
  ) {}

  onEvent(listener: (event: RoomEvent) => void): void {
    this.listener = listener;
  }

  private emit(event: RoomEvent): void {
    this.listener(event);
  }

  // ── Entrar y salir ─────────────────────────────────────────────────────────────────────

  async create(identity: Identity, config: RoomConfig): Promise<Room> {
    this.leave(identity.id);
    const room = this.newRoom('private', config, await this.picker.pick(config));
    this.addPlayer(room, identity);
    room.hostId = identity.id;
    this.store.save(room);
    this.emit({ type: 'state', room });
    return room;
  }

  async join(identity: Identity, request: z.output<typeof roomJoinSchema>): Promise<Room> {
    const current = this.roomOf(identity.id);
    // Recargar la página no saca a nadie de su sala: misma sala privada, o una pública en curso.
    const sameRoom =
      request.mode === 'private'
        ? current?.code === request.code
        : current?.mode === 'public' &&
          current.phase !== 'finished' &&
          current.config.language === request.language;
    if (current && sameRoom) return this.reconnect(identity) ?? current;
    if (current) this.leave(identity.id);

    if (request.mode === 'private') {
      const room = this.store.get(request.code);
      if (room?.mode !== 'private')
        throw new RealtimeException('ROOM_NOT_FOUND', 'No existe esa sala');
      if (room.phase === 'racing')
        throw new RealtimeException('ROOM_CLOSED', 'La carrera ya empezó');
      if (this.humans(room).length >= room.config.maxPlayers) {
        throw new RealtimeException('ROOM_FULL', 'La sala está llena');
      }
      this.addPlayer(room, identity);
      if (room.phase === 'countdown') this.restartCountdown(room);
      this.emit({ type: 'state', room });
      return room;
    }

    const now = this.clock();
    let room = this.openPublicRoom(request.language);
    if (!room) {
      const config: RoomConfig = {
        language: request.language,
        length: 'any',
        botCount: 0,
        botLevel: 'mixed',
        maxPlayers: PUBLIC_RUNNERS,
      };
      room = this.newRoom('public', config, await this.picker.pick(config));
      room.waitingEndsAt = now + this.timings.matchmakingWaitMs;
      this.store.save(room);
    }
    this.addPlayer(room, identity);
    if (room.phase === 'countdown') {
      // Una persona reemplaza a un bot y la cuenta vuelve a empezar (spec 7.1).
      this.prepareBots(room, PUBLIC_RUNNERS - this.humans(room).length);
      this.restartCountdown(room);
    } else if (this.humans(room).length >= PUBLIC_RUNNERS) {
      this.beginCountdown(room);
    }
    this.emit({ type: 'state', room });
    return room;
  }

  /** Sale de su sala. En plena carrera queda como "no terminó". */
  leave(playerId: string): void {
    const room = this.roomOf(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return;
    if (room.phase === 'racing') {
      player.left = true;
      player.connected = false;
      if (!player.run) player.dnf = true;
      this.checkRaceEnd(room);
    } else {
      room.players.delete(playerId);
    }
    this.afterDeparture(room);
  }

  disconnect(playerId: string): void {
    const room = this.roomOf(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return;
    player.connected = false;
    player.disconnectedAt = this.clock();
    if (room.hostId === playerId) this.reassignHost(room);
    this.emit({ type: 'state', room });
  }

  /** Vuelve a su sala si la hay (misma cuenta o mismo invitado) dentro del margen. */
  reconnect(identity: Identity): Room | undefined {
    const room = this.roomOf(identity.id);
    const player = room?.players.get(identity.id);
    if (!room || !player) return undefined;
    player.connected = true;
    player.disconnectedAt = null;
    room.hostId ??= identity.id;
    this.emit({ type: 'state', room });
    return room;
  }

  roomOf(playerId: string): Room | undefined {
    const room = this.store.roomOf(playerId);
    return room && !room.players.get(playerId)?.left ? room : undefined;
  }

  // ── Sala privada ──────────────────────────────────────────────────────────────────────

  setReady(playerId: string, ready: boolean): void {
    const room = this.requireRoom(playerId);
    const player = room.players.get(playerId);
    if (!player || room.phase !== 'waiting') return;
    player.ready = ready;
    const humans = this.humans(room).filter((p) => p.connected);
    if (room.mode === 'private' && humans.length > 0 && humans.every((p) => p.ready)) {
      this.beginCountdown(room);
    }
    this.emit({ type: 'state', room });
  }

  async updateConfig(playerId: string, config: RoomConfig): Promise<void> {
    const room = this.requireHost(playerId);
    if (room.phase !== 'waiting' && room.phase !== 'finished') {
      throw new RealtimeException('ROOM_CLOSED', 'La configuración no se puede cambiar ahora');
    }
    if (config.maxPlayers < this.humans(room).length) {
      throw new RealtimeException('ROOM_FULL', 'Ya hay más jugadores que ese máximo');
    }
    const textChanged =
      config.language !== room.config.language || config.length !== room.config.length;
    room.config = config;
    if (textChanged) room.text = await this.picker.pick(config, room.text.id);
    this.emit({ type: 'state', room });
  }

  start(playerId: string): void {
    const room = this.requireHost(playerId);
    if (room.phase !== 'waiting')
      throw new RealtimeException('ROOM_CLOSED', 'La carrera ya empezó');
    this.beginCountdown(room);
    this.emit({ type: 'state', room });
  }

  /** Revancha: misma sala y mismos jugadores, texto nuevo. */
  async rematch(playerId: string): Promise<void> {
    const room = this.requireRoom(playerId);
    if (room.mode !== 'private')
      throw new RealtimeException('ROOM_CLOSED', 'Las carreras públicas no tienen revancha');
    if (room.phase !== 'finished') return;
    room.text = await this.picker.pick(room.config, room.text.id);
    room.phase = 'waiting';
    room.raceId = randomUUID();
    room.bots = [];
    room.startAt = null;
    room.finishedAt = null;
    for (const [id, player] of room.players) {
      if (player.left) {
        room.players.delete(id);
        continue;
      }
      Object.assign(player, {
        ready: false,
        progressChars: 0,
        progressFlag: null,
        run: null,
        dnf: false,
      });
    }
    this.standings.delete(room);
    this.saved.delete(room);
    this.emit({ type: 'state', room });
  }

  // ── Carrera ───────────────────────────────────────────────────────────────────────────

  /** Progreso en vivo: monótono y plausible para el tiempo transcurrido (spec 7.4). */
  progress(playerId: string, input: RaceProgressInput): void {
    const room = this.requireRoom(playerId);
    const player = room.players.get(playerId);
    if (!player || room.phase !== 'racing' || room.startAt === null || player.run || player.dnf)
      return;
    const elapsed = this.clock() - room.startAt;
    if (elapsed <= 0) return;
    // Primero lo que reporta: 1 000 caracteres a los 2 s es imposible aunque el texto sea corto.
    let chars = input.charIndex;
    const plausible = Math.floor(MAX_LIVE_WPM * 5 * (elapsed / 60_000)) + 15;
    if (chars > plausible) {
      player.progressFlag = 'implausible-progress';
      chars = plausible;
    }
    chars = Math.min(chars, room.totalChars);
    if (chars < player.progressChars - PROGRESS_BACKTRACK) return;
    player.progressChars = chars;
  }

  /** Llegada: el servidor reproduce las pulsaciones y decide el resultado oficial. */
  finish(playerId: string, encoded: EncodedKeystrokes): void {
    const room = this.requireRoom(playerId);
    const player = room.players.get(playerId);
    if (!player || room.phase !== 'racing' || room.startAt === null || player.run || player.dnf)
      return;

    let keystrokes;
    try {
      keystrokes = decodeKeystrokes(encoded);
    } catch {
      throw new RealtimeException('INVALID_RUN', 'Pulsaciones mal codificadas');
    }
    const template = createTypingState({
      text: room.text.content,
      startOn: 'signal',
      timeLimitMs: room.timeLimitMs,
      rules: { mode: 'strict' },
    });
    const state = playKeystrokes(template, keystrokes);
    if (state.phase !== 'finished' || correctChars(state) !== totalChars(state)) {
      throw new RealtimeException('INVALID_RUN', 'Las pulsaciones no completan el texto');
    }
    const metrics = analyze(state);
    const reasons: string[] = [...inspectRun(metrics, state.keystrokes).reasons];
    // No se puede haber terminado antes de lo que lleva la carrera en el reloj del servidor.
    if (metrics.durationMs > this.clock() - room.startAt + FINISH_TOLERANCE_MS)
      reasons.push('time-mismatch');
    if (player.progressFlag) reasons.push(player.progressFlag);

    player.run = { state, metrics, flagReason: reasons.length > 0 ? reasons.join(',') : null };
    player.progressChars = room.totalChars;
    const ahead =
      [...room.players.values()].filter(
        (p) => p.run && p.run.metrics.durationMs < metrics.durationMs,
      ).length + room.bots.filter((bot) => bot.finishMs < metrics.durationMs).length;
    this.emit({ type: 'playerFinished', room, playerId, position: ahead + 1, wpm: metrics.wpm });
    this.checkRaceEnd(room);
  }

  /** Avanza los relojes de todas las salas: matchmaking, salida, límite, desconexiones, limpieza. */
  tick(): void {
    const now = this.clock();
    for (const room of [...this.store.all()]) {
      this.expireDisconnected(room, now);
      if (!this.store.get(room.code)) continue;

      if (
        room.phase === 'waiting' &&
        room.mode === 'public' &&
        room.waitingEndsAt !== null &&
        now >= room.waitingEndsAt
      ) {
        this.beginCountdown(room);
        this.emit({ type: 'state', room });
      } else if (room.phase === 'countdown' && room.startAt !== null && now >= room.startAt) {
        room.phase = 'racing';
        room.lastBroadcastAt = now;
        this.emit({ type: 'state', room });
      } else if (room.phase === 'racing' && room.startAt !== null) {
        if (now - room.startAt >= room.timeLimitMs) {
          for (const player of room.players.values()) if (!player.run) player.dnf = true;
          this.endRace(room);
        } else if (now - room.lastBroadcastAt >= this.timings.broadcastMs) {
          room.lastBroadcastAt = now;
          this.emit({ type: 'progress', room });
        }
      } else if (
        room.phase === 'finished' &&
        room.finishedAt !== null &&
        now - room.finishedAt > this.timings.finishedTtlMs &&
        !this.humans(room).some((p) => p.connected)
      ) {
        this.close(room);
      }
    }
  }

  // ── Estado para el cliente ────────────────────────────────────────────────────────────

  toState(room: Room): RoomState {
    const now = this.clock();
    const elapsed = room.startAt === null ? 0 : Math.max(0, now - room.startAt);
    const standings = this.standings.get(room);
    const positions = new Map(standings?.map((s) => [s.id, s.position]));
    return {
      code: room.code,
      mode: room.mode,
      phase: room.phase,
      hostId: room.hostId,
      config: room.config,
      players: this.humans(room).map((player) => ({
        id: player.identity.id,
        name: player.identity.name,
        avatar: player.identity.avatar,
        registered: player.identity.userId !== null,
        ready: player.ready,
        connected: player.connected,
        progress: room.totalChars ? player.progressChars / room.totalChars : 0,
        wpm: player.run
          ? player.run.metrics.wpm
          : elapsed >= 1_000
            ? wpmFrom(player.progressChars, elapsed)
            : 0,
        finishMs: player.run?.metrics.durationMs ?? null,
        position: positions.get(player.identity.id) ?? null,
        dnf: player.dnf,
      })),
      bots:
        room.phase === 'waiting'
          ? null
          : { seed: room.seed, levels: room.bots.map((bot) => bot.profile.level) },
      waitingEndsAt: room.waitingEndsAt,
      startAt: room.startAt,
      race:
        room.phase === 'waiting'
          ? null
          : {
              id: room.raceId,
              textId: room.text.id,
              text: room.text.content,
              author: room.text.author,
              source: room.text.source,
              timeLimitMs: room.timeLimitMs,
            },
    };
  }

  /** Resultados ya emitidos de la última carrera, para quien vuelve a una sala terminada. */
  resultsFor(room: Room, playerId: string): RaceResults | null {
    const standings = this.standings.get(room);
    const saved = this.saved.get(room);
    if (room.phase !== 'finished' || !standings || !saved) return null;
    return resultsForPlayer(standings, saved, playerId);
  }

  progressSnapshot(room: Room): { id: string; progress: number; wpm: number }[] {
    const state = this.toState(room);
    return state.players.map(({ id, progress, wpm }) => ({ id, progress, wpm }));
  }

  // ── Internos ──────────────────────────────────────────────────────────────────────────

  private newRoom(mode: Room['mode'], config: RoomConfig, text: RoomText): Room {
    let code: string;
    do {
      code = Array.from({ length: 6 }, () =>
        ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length)),
      ).join('');
    } while (this.store.get(code));
    return {
      code,
      mode,
      phase: 'waiting',
      hostId: null,
      config,
      players: new Map(),
      text,
      raceId: randomUUID(),
      seed: 0,
      bots: [],
      waitingEndsAt: null,
      startAt: null,
      timeLimitMs: 0,
      totalChars: 0,
      lastBroadcastAt: 0,
      finishedAt: null,
    };
  }

  private addPlayer(room: Room, identity: Identity): void {
    const player: PlayerState = {
      identity,
      ready: false,
      connected: true,
      disconnectedAt: null,
      progressChars: 0,
      progressFlag: null,
      run: null,
      dnf: false,
      left: false,
    };
    room.players.set(identity.id, player);
    if (room.mode === 'private') room.hostId ??= identity.id;
  }

  private humans(room: Room): PlayerState[] {
    return [...room.players.values()].filter((player) => !player.left);
  }

  private openPublicRoom(language: RoomConfig['language']): Room | undefined {
    for (const room of this.store.all()) {
      if (room.mode !== 'public' || room.config.language !== language) continue;
      const humans = this.humans(room).length;
      if (room.phase === 'waiting' && humans < PUBLIC_RUNNERS) return room;
      if (room.phase === 'countdown' && room.bots.length > 0) return room;
    }
    return undefined;
  }

  private prepareBots(room: Room, count: number): void {
    const rng = createRng(room.seed ^ 0x6a09e667);
    const levels = Array.from({ length: Math.max(0, count) }, (_, index): BotLevel => {
      if (room.mode === 'public')
        return PUBLIC_BOT_LEVELS[index % PUBLIC_BOT_LEVELS.length] ?? 'intermediate';
      const { botLevel } = room.config;
      return botLevel === 'mixed'
        ? (BOT_LEVEL_IDS[seededInt(rng, 0, BOT_LEVEL_IDS.length - 1)] ?? 'intermediate')
        : botLevel;
    });
    room.bots = createBots({ text: room.text.content, levels, seed: room.seed });
  }

  private beginCountdown(room: Room): void {
    room.seed = randomInt(0, 0x7fffffff);
    const botCount =
      room.mode === 'public' ? PUBLIC_RUNNERS - this.humans(room).length : room.config.botCount;
    this.prepareBots(room, botCount);
    const template = createTypingState({ text: room.text.content });
    room.totalChars = totalChars(template);
    room.timeLimitMs = Math.round(
      Math.max(60_000, (room.totalChars / 5 / MIN_WPM_FOR_LIMIT) * 60_000),
    );
    room.waitingEndsAt = null;
    room.phase = 'countdown';
    room.startAt = this.clock() + this.timings.countdownMs;
  }

  private restartCountdown(room: Room): void {
    room.startAt = this.clock() + this.timings.countdownMs;
  }

  private checkRaceEnd(room: Room): void {
    if (room.phase !== 'racing') return;
    if (
      this.humans(room).every((player) => player.run !== null || player.dnf) ||
      this.humans(room).length === 0
    ) {
      this.endRace(room);
    }
  }

  private endRace(room: Room): void {
    if (room.phase === 'finished' || room.startAt === null) return;
    const now = this.clock();
    room.phase = 'finished';
    room.finishedAt = now;
    const limit = room.timeLimitMs;
    const players = [...room.players.values()];

    const runners = [
      ...players.map((player) => ({
        id: player.identity.id,
        finishMs: player.run?.metrics.durationMs ?? null,
        progress: room.totalChars ? player.progressChars / room.totalChars : 0,
      })),
      ...room.bots.map((bot) => ({
        id: bot.profile.id,
        finishMs: bot.finishMs <= limit ? bot.finishMs : null,
        progress: botProgressAt(bot, limit),
      })),
    ];
    const botTemplate = createTypingState({
      text: room.text.content,
      startOn: 'signal',
      rules: { mode: 'strict' },
    });
    const elapsed = Math.min(now - room.startAt, limit);
    const standings: RaceResults['standings'] = rankRunners(runners).map((standing) => {
      const player = room.players.get(standing.id);
      if (player) {
        return {
          id: standing.id,
          name: player.identity.name,
          isBot: false,
          position: standing.position,
          wpm: player.run?.metrics.wpm ?? wpmFrom(player.progressChars, elapsed),
          accuracy: player.run?.metrics.accuracy ?? null,
          finishMs: standing.finishMs,
          flagged: player.run?.flagReason != null,
        };
      }
      const bot = room.bots.find((candidate) => candidate.profile.id === standing.id);
      if (!bot) throw new Error(`Corredor desconocido: ${standing.id}`);
      const metrics = analyze(playKeystrokes(botTemplate, bot.keystrokes));
      return {
        id: standing.id,
        name: bot.profile.name,
        isBot: true,
        position: standing.position,
        wpm: metrics.wpm,
        accuracy: metrics.accuracy,
        finishMs: standing.finishMs,
        flagged: false,
      };
    });
    this.standings.set(room, standings);
    this.emit({ type: 'state', room });
    this.recorder
      .record(room, standings)
      .catch((error: unknown) => {
        this.logger.error(`No se pudieron guardar los resultados de ${room.code}`, error);
        return new Map<string, SavedResult>();
      })
      .then((saved) => {
        this.saved.set(room, saved);
        this.emit({ type: 'results', room, standings, saved });
      })
      .catch(() => undefined);
  }

  private expireDisconnected(room: Room, now: number): void {
    let changed = false;
    for (const [id, player] of room.players) {
      if (player.connected || player.left || player.disconnectedAt === null) continue;
      if (now - player.disconnectedAt < this.timings.reconnectGraceMs) continue;
      changed = true;
      if (room.phase === 'racing') {
        player.left = true;
        if (!player.run) player.dnf = true;
      } else {
        room.players.delete(id);
      }
    }
    if (!changed) return;
    this.checkRaceEnd(room);
    this.afterDeparture(room);
  }

  private afterDeparture(room: Room): void {
    if (this.humans(room).length === 0 && room.phase !== 'racing') {
      this.close(room);
      return;
    }
    if (
      room.hostId !== null &&
      !this.humans(room).some((p) => p.identity.id === room.hostId && p.connected)
    ) {
      this.reassignHost(room);
    }
    this.emit({ type: 'state', room });
  }

  private reassignHost(room: Room): void {
    if (room.mode !== 'private') return;
    const next = this.humans(room).find((player) => player.connected);
    room.hostId = next?.identity.id ?? room.hostId;
  }

  private close(room: Room): void {
    this.store.delete(room.code);
    this.emit({ type: 'closed', room });
  }

  private requireRoom(playerId: string): Room {
    const room = this.roomOf(playerId);
    if (!room) throw new RealtimeException('NOT_IN_ROOM', 'No estás en una sala');
    return room;
  }

  private requireHost(playerId: string): Room {
    const room = this.requireRoom(playerId);
    if (room.mode !== 'private' || room.hostId !== playerId) {
      throw new RealtimeException('NOT_HOST', 'Solo quien creó la sala puede hacer esto');
    }
    return room;
  }
}
