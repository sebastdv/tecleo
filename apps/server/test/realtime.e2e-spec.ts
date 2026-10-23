import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { encodeKeystrokes } from '@tecleo/engine';
import { DEFAULT_ROOM_CONFIG, EVENTS, type RaceResults, type RoomState } from '@tecleo/shared';
import { io, type Socket } from 'socket.io-client';
import type { App } from 'supertest/types.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createApp, registerUser, resetDatabase } from './helpers.js';

const TEXT = 'hola mundo';

describe('tiempo real (Socket.IO)', () => {
  let app: INestApplication<App>;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    url = await app.getUrl();
  });
  beforeEach(async () => {
    await resetDatabase(app);
    await app.get(PrismaService).text.create({
      data: {
        id: 'es-hola',
        content: TEXT,
        language: 'es',
        type: 'quote',
        length: TEXT.length,
        difficulty: 10,
      },
    });
  });
  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });
  afterAll(async () => {
    await app.close();
  });

  function connect(auth: Record<string, string>): Promise<Socket> {
    const socket = io(url, { auth, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => {
        resolve(socket);
      });
      socket.once('connect_error', reject);
    });
  }

  function next<T>(
    socket: Socket,
    event: string,
    predicate: (value: T) => boolean = () => true,
  ): Promise<T> {
    return new Promise((resolve) => {
      const handler = (value: T) => {
        if (!predicate(value)) return;
        socket.off(event, handler);
        resolve(value);
      };
      socket.on(event, handler);
    });
  }

  /** Escribe "hola mundo" con ritmo humano; los tiempos van desde la salida. */
  function keystrokesFor(text: string) {
    let t = 200;
    return encodeKeystrokes(
      Array.from(text).map((input, index) => {
        if (index > 0) t += 120 + ((index * 37) % 7) * 20;
        return { t, input };
      }),
    );
  }

  const guest = (id: string, name: string) => ({ guestId: id, guestName: name });
  // Invitados nuevos en cada prueba: las salas viven en memoria durante todo el archivo.
  let GUEST_A = randomUUID();
  let GUEST_B = randomUUID();
  beforeEach(() => {
    GUEST_A = randomUUID();
    GUEST_B = randomUUID();
  });

  it('sala privada: dos jugadores, cuenta regresiva, salida, llegada y resultados', async () => {
    const ana = await connect(guest(GUEST_A, 'Ana'));
    const beto = await connect(guest(GUEST_B, 'Beto'));

    const created = (await ana.emitWithAck(EVENTS.roomCreate, { config: DEFAULT_ROOM_CONFIG })) as {
      ok: true;
      code: string;
    };
    expect(created.ok).toBe(true);
    const joined = (await beto.emitWithAck(EVENTS.roomJoin, {
      mode: 'private',
      code: created.code.toLowerCase(),
    })) as { ok: boolean };
    expect(joined.ok).toBe(true);

    const countdown = next<{ startAt: number }>(ana, EVENTS.raceCountdown);
    const started = next<{ text: string; startAt: number }>(beto, EVENTS.raceStart);
    await ana.emitWithAck(EVENTS.roomReady, { ready: true });
    await beto.emitWithAck(EVENTS.roomReady, { ready: true });
    const { startAt } = await countdown;
    expect(startAt).toBeGreaterThan(Date.now() - 100);
    const start = await started;
    expect(start.text).toBe(TEXT);

    // Progreso a mitad de carrera y difusión de posiciones.
    const progress = next<{ players: { id: string; progress: number }[] }>(
      ana,
      EVENTS.raceProgress,
      (value) => value.players.some((p) => p.progress > 0),
    );
    beto.emit(EVENTS.raceProgress, { charIndex: 4, errors: 0, wpm: 40, clientTime: Date.now() });
    const snapshot = await progress;
    expect(snapshot.players.find((p) => p.id === `guest:${GUEST_B}`)?.progress).toBeCloseTo(
      4 / TEXT.length,
      5,
    );

    // Esperar lo que "tardaron" en escribir: llegar antes es trampa (time-mismatch).
    await new Promise((resolve) => setTimeout(resolve, 1_800));
    const results = next<RaceResults>(beto, EVENTS.raceResults);
    await ana.emitWithAck(EVENTS.raceFinish, { keystrokes: keystrokesFor(TEXT) });
    await beto.emitWithAck(EVENTS.raceFinish, { keystrokes: keystrokesFor(TEXT) });
    const { standings, savedResultId } = await results;
    expect(standings).toHaveLength(2);
    expect(standings.every((s) => !s.flagged)).toBe(true);
    expect(savedResultId).toBeNull();
  });

  it('con cuenta, el resultado multijugador se guarda en el perfil', async () => {
    const user = await registerUser(app, 'corredora');
    const socket = await connect({ token: user.accessToken });
    const created = (await socket.emitWithAck(EVENTS.roomCreate, {
      config: DEFAULT_ROOM_CONFIG,
    })) as { code: string };
    const state = next<RoomState>(socket, EVENTS.roomState, (value) => value.phase === 'racing');
    await socket.emitWithAck(EVENTS.roomStart, {});
    await state;
    await new Promise((resolve) => setTimeout(resolve, 1_800));
    const results = next<RaceResults>(socket, EVENTS.raceResults);
    await socket.emitWithAck(EVENTS.raceFinish, { keystrokes: keystrokesFor(TEXT) });
    const { savedResultId, progress } = await results;
    expect(savedResultId).not.toBeNull();
    expect(progress?.xpGained).toBeGreaterThan(0);
    expect(progress?.achievements).toEqual(expect.arrayContaining(['first-race', 'online-first']));
    const saved = await app
      .get(PrismaService)
      .raceResult.findUniqueOrThrow({ where: { id: savedResultId ?? '' } });
    expect(saved).toMatchObject({ mode: 'private', position: 1, completed: true, flagged: false });
    expect(created.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('rechaza eventos malformados y avisa con un error tipado', async () => {
    const socket = await connect(guest(GUEST_A, 'Ana'));
    const error = next<{ code: string }>(socket, EVENTS.error);
    const ack = (await socket.emitWithAck(EVENTS.roomJoin, { mode: 'private', code: '0000' })) as {
      ok: boolean;
    };
    expect(ack.ok).toBe(false);
    expect((await error).code).toBe('VALIDATION');
    const notInRoom = (await socket.emitWithAck(EVENTS.roomReady, { ready: true })) as {
      ok: false;
      error: { code: string };
    };
    expect(notInRoom.error.code).toBe('NOT_IN_ROOM');
  });

  it('reconexión: el mismo invitado vuelve a la carrera en curso con el texto y la salida', async () => {
    const first = await connect(guest(GUEST_A, 'Ana'));
    await first.emitWithAck(EVENTS.roomCreate, { config: DEFAULT_ROOM_CONFIG });
    const racing = next<RoomState>(first, EVENTS.roomState, (value) => value.phase === 'racing');
    await first.emitWithAck(EVENTS.roomStart, {});
    const before = await racing;
    first.disconnect();

    const again = io(url, {
      auth: guest(GUEST_A, 'Ana'),
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(again);
    const state = await next<RoomState>(again, EVENTS.roomState);
    expect(state).toMatchObject({ code: before.code, phase: 'racing', startAt: before.startAt });
    expect(state.race?.text).toBe(TEXT);
    expect(state.players[0]?.connected).toBe(true);
  });

  it('sincronización de reloj: responde con la hora del servidor', async () => {
    const socket = await connect(guest(GUEST_A, 'Ana'));
    const sent = Date.now();
    const pong = (await socket.emitWithAck(EVENTS.timePing, { clientTime: sent })) as {
      clientTime: number;
      serverTime: number;
    };
    expect(pong.clientTime).toBe(sent);
    expect(Math.abs(pong.serverTime - Date.now())).toBeLessThan(1_000);
  });

  it('carrera pública: si no llega nadie, se completa con bots hasta 5', async () => {
    const socket = await connect(guest(GUEST_A, 'Ana'));
    const countdown = next<RoomState>(
      socket,
      EVENTS.roomState,
      (value) => value.phase === 'countdown',
    );
    const ack = (await socket.emitWithAck(EVENTS.roomJoin, { mode: 'public', language: 'es' })) as {
      ok: boolean;
    };
    expect(ack.ok).toBe(true);
    const state = await countdown;
    expect(state.mode).toBe('public');
    expect(state.bots?.levels).toHaveLength(4);
  });
});
