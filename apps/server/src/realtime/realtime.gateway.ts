import { randomUUID } from 'node:crypto';

import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import {
  AVATARS,
  EVENTS,
  raceFinishSchema,
  raceProgressSchema,
  roomConfigUpdateSchema,
  roomCreateSchema,
  roomJoinSchema,
  roomReadySchema,
  timePingSchema,
  type RealtimeError,
} from '@tecleo/shared';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';

import { TokensService } from '../auth/tokens.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenBucket } from './rate-limiter.js';
import type { Identity, Room } from './room.js';
import { RealtimeException, RoomsService, type RoomEvent } from './rooms.service.js';

const TICK_MS = 100;
/** Si un socket supera tantas veces su límite, se desconecta. */
const MAX_RATE_VIOLATIONS = 50;
const channel = (code: string) => `room:${code}`;

const handshakeSchema = z.object({
  token: z.string().optional(),
  guestId: z.uuid().optional(),
  guestName: z.string().optional(),
});

interface SocketData {
  identity: Identity;
  limits: { progress: TokenBucket; actions: TokenBucket };
  violations: number;
}

type Ack = { ok: true; code?: string } | { ok: false; error: RealtimeError };

/** Nombre visible de un invitado: letras, números, espacios, guiones; si no sirve, uno genérico. */
function guestName(raw: string | undefined, id: string): string {
  const cleaned = (raw ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .slice(0, 20);
  return cleaned.length >= 2 ? cleaned : `Invitado ${id.slice(0, 4).toUpperCase()}`;
}

/**
 * Tiempo real (spec 7). El gateway solo identifica, valida, limita y traduce: la lógica de las
 * salas vive en `RoomsService`, que es autoritativo.
 */
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  /** Última fase emitida por sala, para avisar la cuenta regresiva y la salida una sola vez. */
  private readonly phases = new Map<string, string>();

  constructor(
    private readonly rooms: RoomsService,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.rooms.onEvent((event) => {
      this.dispatch(event);
    });
    this.timer = setInterval(() => {
      this.rooms.tick();
    }, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // ── Conexión ──────────────────────────────────────────────────────────────────────────

  /**
   * La identidad se resuelve en un middleware: el cliente no recibe `connect` (y no puede
   * emitir nada) hasta que el socket tiene identidad y límites.
   */
  afterInit(server: Server) {
    server.use((socket, next) => {
      this.identify(socket)
        .then((identity) => {
          if (!identity) {
            next(new Error('Conexión sin identidad'));
            return;
          }
          const now = Date.now();
          const data: SocketData = {
            identity,
            limits: {
              progress: new TokenBucket(30, 20, now),
              actions: new TokenBucket(10, 5, now),
            },
            violations: 0,
          };
          socket.data = data;
          next();
        })
        .catch((error: unknown) => {
          this.logger.error('No se pudo identificar una conexión', error);
          next(new Error('No se pudo identificar la conexión'));
        });
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { identity } = socket.data as SocketData;
    // Si estaba en una carrera (recarga o corte de red), vuelve a ella con su progreso.
    const room = this.rooms.reconnect(identity);
    if (room) await this.enter(socket, room);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const data = socket.data as Partial<SocketData>;
    if (!data.identity) return;
    // Puede tener otra pestaña abierta con la misma identidad.
    const others = await this.server.fetchSockets();
    const stillConnected = others.some(
      (other) =>
        other.id !== socket.id &&
        (other.data as Partial<SocketData>).identity?.id === data.identity?.id,
    );
    if (!stillConnected) this.rooms.disconnect(data.identity.id);
  }

  private async identify(socket: Socket): Promise<Identity | null> {
    const auth = handshakeSchema.safeParse(socket.handshake.auth);
    if (!auth.success) return null;
    if (auth.data.token) {
      const userId = await this.tokens.verifyAccessToken(auth.data.token);
      const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
      if (user) {
        return {
          id: `user:${user.id}`,
          userId: user.id,
          name: user.nickname,
          avatar: AVATARS.find((avatar) => avatar === user.avatar) ?? null,
        };
      }
    }
    const guestId = auth.data.guestId ?? randomUUID();
    return {
      id: `guest:${guestId}`,
      userId: null,
      name: guestName(auth.data.guestName, guestId),
      avatar: null,
    };
  }

  // ── Eventos del cliente ───────────────────────────────────────────────────────────────

  @SubscribeMessage(EVENTS.roomCreate)
  roomCreate(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    return this.handle(socket, roomCreateSchema, body, async (input, identity) => {
      const room = await this.rooms.create(identity, input.config);
      await this.enter(socket, room);
      return { ok: true, code: room.code };
    });
  }

  @SubscribeMessage(EVENTS.roomJoin)
  roomJoin(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    return this.handle(socket, roomJoinSchema, body, async (input, identity) => {
      const room = await this.rooms.join(identity, input);
      await this.enter(socket, room);
      return { ok: true, code: room.code };
    });
  }

  @SubscribeMessage(EVENTS.roomLeave)
  roomLeave(@ConnectedSocket() socket: Socket): Promise<Ack> {
    return this.handle(socket, z.unknown(), null, async (_input, identity) => {
      const room = this.rooms.roomOf(identity.id);
      this.rooms.leave(identity.id);
      if (room) await socket.leave(channel(room.code));
      return { ok: true };
    });
  }

  @SubscribeMessage(EVENTS.roomReady)
  roomReady(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    return this.handle(socket, roomReadySchema, body, (input, identity) => {
      this.rooms.setReady(identity.id, input.ready);
      return Promise.resolve({ ok: true });
    });
  }

  @SubscribeMessage(EVENTS.roomConfig)
  roomConfig(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    return this.handle(socket, roomConfigUpdateSchema, body, async (input, identity) => {
      await this.rooms.updateConfig(identity.id, input.config);
      return { ok: true };
    });
  }

  @SubscribeMessage(EVENTS.roomStart)
  roomStart(@ConnectedSocket() socket: Socket): Promise<Ack> {
    return this.handle(socket, z.unknown(), null, (_input, identity) => {
      this.rooms.start(identity.id);
      return Promise.resolve({ ok: true });
    });
  }

  @SubscribeMessage(EVENTS.roomRematch)
  roomRematch(@ConnectedSocket() socket: Socket): Promise<Ack> {
    return this.handle(socket, z.unknown(), null, async (_input, identity) => {
      await this.rooms.rematch(identity.id);
      return { ok: true };
    });
  }

  @SubscribeMessage(EVENTS.raceProgress)
  raceProgress(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    return this.handle(
      socket,
      raceProgressSchema,
      body,
      (input, identity) => {
        this.rooms.progress(identity.id, input);
        return Promise.resolve({ ok: true });
      },
      'progress',
    );
  }

  @SubscribeMessage(EVENTS.raceFinish)
  raceFinish(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    return this.handle(socket, raceFinishSchema, body, (input, identity) => {
      this.rooms.finish(identity.id, input.keystrokes);
      return Promise.resolve({ ok: true });
    });
  }

  /** Sincronización de reloj: responde con la hora del servidor (spec 7.3). */
  @SubscribeMessage(EVENTS.timePing)
  timePing(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const parsed = timePingSchema.safeParse(body);
    if (!parsed.success)
      return { ok: false, error: { code: 'VALIDATION', message: 'Ping inválido' } };
    const pong = { clientTime: parsed.data.clientTime, serverTime: Date.now() };
    socket.emit(EVENTS.timePong, pong);
    return pong;
  }

  // ── Internos ──────────────────────────────────────────────────────────────────────────

  private async handle<S extends z.ZodType>(
    socket: Socket,
    schema: S,
    body: unknown,
    action: (input: z.output<S>, identity: Identity) => Promise<Ack>,
    limit: keyof SocketData['limits'] = 'actions',
  ): Promise<Ack> {
    const data = socket.data as SocketData;
    if (!data.limits[limit].take(Date.now())) {
      data.violations++;
      if (data.violations > MAX_RATE_VIOLATIONS) socket.disconnect(true);
      return this.fail(socket, { code: 'RATE_LIMITED', message: 'Demasiados eventos' });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return this.fail(socket, { code: 'VALIDATION', message: 'Evento inválido' });
    try {
      return await action(parsed.data, data.identity);
    } catch (error) {
      if (error instanceof RealtimeException)
        return this.fail(socket, { code: error.code, message: error.message });
      this.logger.error('Error en un evento de tiempo real', error);
      return this.fail(socket, { code: 'VALIDATION', message: 'No se pudo procesar el evento' });
    }
  }

  private fail(socket: Socket, error: RealtimeError): Ack {
    socket.emit(EVENTS.error, error);
    return { ok: false, error };
  }

  /** Une el socket al canal de su sala (y lo saca de cualquier otra) y le manda el estado. */
  private async enter(socket: Socket, room: Room): Promise<void> {
    for (const joined of socket.rooms) {
      if (joined.startsWith('room:') && joined !== channel(room.code)) await socket.leave(joined);
    }
    await socket.join(channel(room.code));
    socket.emit(EVENTS.roomState, this.rooms.toState(room));
    const { identity } = socket.data as SocketData;
    const results = this.rooms.resultsFor(room, identity.id);
    if (results) socket.emit(EVENTS.raceResults, results);
  }

  private dispatch(event: RoomEvent): void {
    const target = this.server.to(channel(event.room.code));
    switch (event.type) {
      case 'state': {
        const state = this.rooms.toState(event.room);
        const previous = this.phases.get(event.room.code);
        this.phases.set(event.room.code, state.phase);
        target.emit(EVENTS.roomState, state);
        if (state.phase === 'countdown' && state.startAt !== null) {
          target.emit(EVENTS.raceCountdown, { startAt: state.startAt });
        }
        if (
          state.phase === 'racing' &&
          previous !== 'racing' &&
          state.race &&
          state.startAt !== null
        ) {
          target.emit(EVENTS.raceStart, {
            textId: state.race.textId,
            text: state.race.text,
            startAt: state.startAt,
          });
        }
        break;
      }
      case 'progress':
        target.emit(EVENTS.raceProgress, {
          players: this.rooms.progressSnapshot(event.room),
          serverTime: Date.now(),
        });
        break;
      case 'playerFinished':
        target.emit(EVENTS.racePlayerFinished, {
          playerId: event.playerId,
          position: event.position,
          wpm: event.wpm,
        });
        break;
      case 'results':
        void this.server
          .in(channel(event.room.code))
          .fetchSockets()
          .then((sockets) => {
            for (const socket of sockets) {
              const identity = (socket.data as Partial<SocketData>).identity;
              socket.emit(EVENTS.raceResults, {
                standings: event.standings,
                savedResultId: (identity && event.saved.get(identity.id)) ?? null,
              });
            }
          });
        break;
      case 'closed':
        this.phases.delete(event.room.code);
        this.server.in(channel(event.room.code)).socketsLeave(channel(event.room.code));
        break;
    }
  }
}
