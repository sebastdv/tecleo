import { encodeKeystrokes } from '@tecleo/engine';
import { DEFAULT_ROOM_CONFIG, type RaceResults, type RoomConfig } from '@tecleo/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryRoomStore } from './room-store.js';
import type { Identity, Room, RoomText } from './room.js';
import {
  RaceRecorder,
  RealtimeException,
  RoomsService,
  TextPicker,
  type RoomEvent,
} from './rooms.service.js';

const TEXT: RoomText = {
  id: 'es-t',
  content: 'el sol sale por el este',
  author: 'Autor',
  source: 'Obra',
};
const TIMINGS = {
  matchmakingWaitMs: 10_000,
  countdownMs: 5_000,
  reconnectGraceMs: 30_000,
  broadcastMs: 150,
  finishedTtlMs: 120_000,
};

class FakePicker extends TextPicker {
  pick = vi.fn((_config: RoomConfig, _exclude?: string) => Promise.resolve(TEXT));
}

class FakeRecorder extends RaceRecorder {
  record = vi.fn((room: Room, _standings: RaceResults['standings']) =>
    Promise.resolve(
      new Map(
        [...room.players.values()]
          .filter((player) => player.identity.userId !== null)
          .map((player) => [player.identity.id, `result-${player.identity.id}`]),
      ),
    ),
  );
}

const person = (name: string, registered = true): Identity => ({
  id: registered ? `user:${name}` : `guest:${name}`,
  userId: registered ? name : null,
  name,
  avatar: null,
});

/** Pulsaciones que completan `text` con ritmo humano: `msPerChar` de media, tiempos desde la salida. */
function run(text: string, msPerChar: number, delay = 300) {
  let t = delay;
  const keystrokes = Array.from(text).map((input, index) => {
    if (index > 0) t += Math.round(msPerChar * (0.6 + ((index * 7919) % 11) / 12));
    return { t, input };
  });
  return { encoded: encodeKeystrokes(keystrokes), durationMs: t };
}

describe('RoomsService', () => {
  let now: number;
  let picker: FakePicker;
  let recorder: FakeRecorder;
  let rooms: RoomsService;
  let events: RoomEvent[];

  const advance = (ms: number) => {
    now += ms;
    rooms.tick();
  };
  const ana = person('ana');
  const beto = person('beto', false);
  const caro = person('caro');

  beforeEach(() => {
    now = 1_000_000;
    picker = new FakePicker();
    recorder = new FakeRecorder();
    rooms = new RoomsService(new InMemoryRoomStore(), picker, recorder, () => now, TIMINGS);
    events = [];
    rooms.onEvent((event) => events.push(event));
  });

  async function privateRace(config: Partial<RoomConfig> = {}) {
    const room = await rooms.create(ana, { ...DEFAULT_ROOM_CONFIG, ...config });
    await rooms.join(beto, { mode: 'private', code: room.code });
    rooms.setReady(ana.id, true);
    rooms.setReady(beto.id, true);
    advance(TIMINGS.countdownMs);
    return room;
  }

  describe('sala privada', () => {
    it('quien crea es anfitrión; con todos listos empieza la cuenta regresiva', async () => {
      const room = await rooms.create(ana, DEFAULT_ROOM_CONFIG);
      expect(room.hostId).toBe(ana.id);
      expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
      await rooms.join(beto, { mode: 'private', code: room.code });
      rooms.setReady(ana.id, true);
      expect(room.phase).toBe('waiting');
      rooms.setReady(beto.id, true);
      expect(room.phase).toBe('countdown');
      expect(room.startAt).toBe(now + TIMINGS.countdownMs);
    });

    it('la cuenta regresiva se reinicia si entra alguien', async () => {
      const room = await rooms.create(ana, DEFAULT_ROOM_CONFIG);
      rooms.start(ana.id);
      advance(3_000);
      await rooms.join(caro, { mode: 'private', code: room.code });
      expect(room.startAt).toBe(now + TIMINGS.countdownMs);
    });

    it('rechaza códigos inexistentes, salas llenas, carreras empezadas y órdenes de no anfitriones', async () => {
      await expect(rooms.join(beto, { mode: 'private', code: 'ZZZZZZ' })).rejects.toMatchObject({
        code: 'ROOM_NOT_FOUND',
      });
      const room = await rooms.create(ana, { ...DEFAULT_ROOM_CONFIG, maxPlayers: 2 });
      await rooms.join(beto, { mode: 'private', code: room.code });
      await expect(rooms.join(caro, { mode: 'private', code: room.code })).rejects.toMatchObject({
        code: 'ROOM_FULL',
      });
      expect(() => {
        rooms.start(beto.id);
      }).toThrow(RealtimeException);
      rooms.start(ana.id);
      advance(TIMINGS.countdownMs);
      rooms.leave(beto.id);
      await expect(rooms.join(caro, { mode: 'private', code: room.code })).rejects.toMatchObject({
        code: 'ROOM_CLOSED',
      });
    });

    it('si se va el anfitrión, otro toma su lugar; si se van todos, la sala se cierra', async () => {
      const room = await rooms.create(ana, DEFAULT_ROOM_CONFIG);
      await rooms.join(beto, { mode: 'private', code: room.code });
      rooms.leave(ana.id);
      expect(room.hostId).toBe(beto.id);
      rooms.leave(beto.id);
      expect(events.at(-1)?.type).toBe('closed');
      expect(rooms.roomOf(beto.id)).toBeUndefined();
    });

    it('incluye los bots pedidos con niveles reproducibles', async () => {
      const room = await privateRace({ botCount: 3, botLevel: 'advanced' });
      expect(room.bots).toHaveLength(3);
      expect(room.bots.every((bot) => bot.profile.level === 'advanced')).toBe(true);
      expect(rooms.toState(room).bots).toEqual({
        seed: room.seed,
        levels: ['advanced', 'advanced', 'advanced'],
      });
    });
  });

  describe('carrera', () => {
    it('arranca en la hora de salida y difunde posiciones periódicamente', async () => {
      const room = await privateRace();
      expect(room.phase).toBe('racing');
      events = [];
      advance(200);
      expect(events.some((event) => event.type === 'progress')).toBe(true);
    });

    it('acepta progreso monótono y recorta el imposible marcándolo', async () => {
      const room = await privateRace();
      advance(2_000);
      rooms.progress(ana.id, { charIndex: 5, errors: 0, wpm: 30, clientTime: 0 });
      expect(room.players.get(ana.id)?.progressChars).toBe(5);
      rooms.progress(ana.id, { charIndex: 3, errors: 0, wpm: 30, clientTime: 0 });
      expect(room.players.get(ana.id)?.progressChars).toBe(3);
      // 23 caracteres en 2 s serían unos 140 ppm: plausible; 1 000 no.
      rooms.progress(beto.id, { charIndex: 1_000, errors: 0, wpm: 999, clientTime: 0 });
      expect(room.players.get(beto.id)?.progressFlag).toBe('implausible-progress');
      expect(room.players.get(beto.id)?.progressChars).toBeLessThanOrEqual(room.totalChars);
    });

    it('valida la llegada reproduciendo las pulsaciones y ordena por tiempo', async () => {
      const room = await privateRace({ botCount: 1, botLevel: 'beginner' });
      const fast = run(TEXT.content, 120);
      const slow = run(TEXT.content, 200);
      advance(slow.durationMs + 500);
      rooms.finish(beto.id, slow.encoded);
      rooms.finish(ana.id, fast.encoded);
      const finished = events.filter((event) => event.type === 'playerFinished');
      expect(finished).toHaveLength(2);
      expect(room.phase).toBe('finished');

      await vi.waitFor(() => {
        expect(events.some((event) => event.type === 'results')).toBe(true);
      });
      const results = events.find((event) => event.type === 'results');
      if (results?.type !== 'results') throw new Error('Sin resultados');
      expect(results.standings.map((s) => s.id).slice(0, 2)).toEqual([ana.id, beto.id]);
      expect(results.standings.find((s) => s.isBot)).toBeDefined();
      expect(results.saved.get(ana.id)).toBe(`result-${ana.id}`);
      expect(results.saved.has(beto.id)).toBe(false);
      expect(rooms.toState(room).players.find((p) => p.id === ana.id)?.position).toBe(1);
      // Quien vuelve a la sala terminada recibe los mismos resultados con su id guardado.
      expect(rooms.resultsFor(room, ana.id)).toEqual({
        standings: results.standings,
        savedResultId: `result-${ana.id}`,
      });
      expect(rooms.resultsFor(room, beto.id)?.savedResultId).toBeNull();
    });

    it('marca una llegada que dice haber terminado antes de lo que lleva la carrera', async () => {
      const room = await privateRace();
      const claimed = run(TEXT.content, 150);
      advance(500);
      rooms.finish(ana.id, claimed.encoded);
      expect(room.players.get(ana.id)?.run?.flagReason).toContain('time-mismatch');
    });

    it('rechaza pulsaciones que no completan el texto', async () => {
      await privateRace();
      advance(1_000);
      const partial = encodeKeystrokes([{ t: 300, input: 'e' }]);
      expect(() => {
        rooms.finish(ana.id, partial);
      }).toThrow(expect.objectContaining({ code: 'INVALID_RUN' }));
    });

    it('al cumplirse el límite, quien no terminó queda como "no terminó"', async () => {
      const room = await privateRace();
      const done = run(TEXT.content, 150);
      advance(done.durationMs + 100);
      rooms.finish(ana.id, done.encoded);
      advance(room.timeLimitMs);
      expect(room.phase).toBe('finished');
      expect(room.players.get(beto.id)?.dnf).toBe(true);
    });
  });

  describe('reconexión', () => {
    it('dentro del margen vuelve con su progreso; pasado el margen, no terminó', async () => {
      const room = await privateRace();
      advance(2_000);
      rooms.progress(beto.id, { charIndex: 6, errors: 0, wpm: 30, clientTime: 0 });
      rooms.disconnect(beto.id);
      advance(10_000);
      expect(rooms.reconnect(beto)?.code).toBe(room.code);
      expect(room.players.get(beto.id)).toMatchObject({ connected: true, progressChars: 6 });

      rooms.disconnect(beto.id);
      advance(TIMINGS.reconnectGraceMs + 1);
      expect(room.players.get(beto.id)?.dnf).toBe(true);
      expect(rooms.reconnect(beto)).toBeUndefined();
    });
  });

  describe('matchmaking público', () => {
    it('espera ~10 s y completa con bots hasta 5 corredores', async () => {
      const room = await rooms.join(ana, { mode: 'public', language: 'es' });
      expect(room.mode).toBe('public');
      expect(room.waitingEndsAt).toBe(now + TIMINGS.matchmakingWaitMs);
      const same = await rooms.join(beto, { mode: 'public', language: 'es' });
      expect(same.code).toBe(room.code);
      advance(TIMINGS.matchmakingWaitMs);
      expect(room.phase).toBe('countdown');
      expect(room.bots).toHaveLength(3);
    });

    it('una persona que llega en la cuenta regresiva reemplaza a un bot y la reinicia', async () => {
      const room = await rooms.join(ana, { mode: 'public', language: 'es' });
      advance(TIMINGS.matchmakingWaitMs);
      expect(room.bots).toHaveLength(4);
      advance(2_000);
      await rooms.join(caro, { mode: 'public', language: 'es' });
      expect(room.bots).toHaveLength(3);
      expect(room.startAt).toBe(now + TIMINGS.countdownMs);
    });

    it('pedir matchmaking de nuevo (recarga) no saca a nadie de su carrera pública', async () => {
      const room = await rooms.join(ana, { mode: 'public', language: 'es' });
      advance(TIMINGS.matchmakingWaitMs);
      advance(TIMINGS.countdownMs);
      rooms.disconnect(ana.id);
      const again = await rooms.join(ana, { mode: 'public', language: 'es' });
      expect(again.code).toBe(room.code);
      expect(room.players.get(ana.id)?.connected).toBe(true);
    });

    it('separa por idioma y no mete a nadie en una carrera ya empezada', async () => {
      const es = await rooms.join(ana, { mode: 'public', language: 'es' });
      const en = await rooms.join(beto, { mode: 'public', language: 'en' });
      expect(en.code).not.toBe(es.code);
      advance(TIMINGS.matchmakingWaitMs);
      advance(TIMINGS.countdownMs);
      expect(es.phase).toBe('racing');
      const next = await rooms.join(caro, { mode: 'public', language: 'es' });
      expect(next.code).not.toBe(es.code);
    });
  });

  describe('revancha', () => {
    it('vuelve a la espera con los mismos jugadores y texto nuevo', async () => {
      const room = await privateRace();
      const firstRace = room.raceId;
      advance(room.timeLimitMs + 1);
      expect(room.phase).toBe('finished');
      await rooms.rematch(beto.id);
      expect(room.phase).toBe('waiting');
      expect(room.raceId).not.toBe(firstRace);
      expect([...room.players.values()].every((p) => !p.ready && p.run === null && !p.dnf)).toBe(
        true,
      );
      expect(picker.pick).toHaveBeenLastCalledWith(room.config, TEXT.id);
    });
  });
});
