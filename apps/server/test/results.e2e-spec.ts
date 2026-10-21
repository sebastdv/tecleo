import type { INestApplication } from '@nestjs/common';
import { analyze, createBots, encodeKeystrokes, stateText } from '@tecleo/engine';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createApp, practicePayload, registerUser, resetDatabase, typeRun } from './helpers.js';

const TEXT = 'En un lugar de la Mancha, de cuyo nombre no quiero acordarme.';

describe('resultados', () => {
  let app: INestApplication<App>;
  let auth: { Authorization: string };
  let nickname: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });
  beforeEach(async () => {
    await resetDatabase(app);
    const user = await registerUser(app);
    auth = { Authorization: `Bearer ${user.accessToken}` };
    nickname = user.user.nickname;
    await app.get(PrismaService).text.create({
      data: {
        id: 'es-test',
        content: TEXT,
        language: 'es',
        type: 'quote',
        length: TEXT.length,
        difficulty: 30,
      },
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it('exige sesión', async () => {
    await http()
      .post('/results')
      .send(practicePayload(typeRun(TEXT)))
      .expect(401);
  });

  it('calcula las métricas oficiales reproduciendo las pulsaciones con el motor', async () => {
    const run = typeRun(TEXT);
    const expected = analyze(run);
    const response = await http()
      .post('/results')
      .set(auth)
      .send(practicePayload(run, { textId: 'es-test', practiceKind: 'text' }))
      .expect(201);
    expect(response.body).toMatchObject({
      mode: 'practice',
      completed: true,
      flagged: false,
      runners: 1,
    });
    expect(response.body.wpm).toBeCloseTo(expected.wpm, 6);
    expect(response.body.accuracy).toBeCloseTo(expected.accuracy, 6);
  });

  it('rechaza un texto que no coincide con el del corpus', async () => {
    const run = typeRun('otro texto cualquiera');
    const response = await http()
      .post('/results')
      .set(auth)
      .send(practicePayload(run, { textId: 'es-test' }))
      .expect(422);
    expect(response.body.code).toBe('TEXT_MISMATCH');
  });

  it('rechaza pulsaciones que no completan la prueba', async () => {
    const run = typeRun(TEXT, { until: 10 });
    const payload = { ...practicePayload(run), content: TEXT };
    const response = await http().post('/results').set(auth).send(payload).expect(422);
    expect(response.body.code).toBe('INCOMPLETE_RUN');
  });

  it('marca ritmos de script y no aprende teclas débiles de ellos', async () => {
    const run = typeRun(TEXT, { msPerChar: 120 });
    // Mismos caracteres, intervalos idénticos: imposible para una persona.
    const uniform = run.keystrokes.map((keystroke, index) => ({ ...keystroke, t: index * 120 }));
    const response = await http()
      .post('/results')
      .set(auth)
      .send({ ...practicePayload(run), keystrokes: encodeKeystrokes(uniform) })
      .expect(201);
    expect(response.body.flagged).toBe(true);
    expect(await app.get(PrismaService).keyStat.count()).toBe(0);
  });

  it('carrera contra bots: el servidor regenera los bots con la semilla y decide el puesto', async () => {
    const run = typeRun(TEXT, { startOn: 'signal', msPerChar: 70 });
    const bots = { seed: 1234, levels: ['beginner', 'intermediate'] as const };
    const response = await http()
      .post('/results')
      .set(auth)
      .send(
        practicePayload(run, {
          mode: 'bots',
          textId: 'es-test',
          practiceKind: null,
          rules: { mode: 'strict', ignoreAccents: false },
          bots: { seed: bots.seed, levels: [...bots.levels] },
        }),
      )
      .expect(201);
    expect(response.body).toMatchObject({ position: 1, runners: 3 });

    const race = await http().get(`/races/${response.body.raceId}`).expect(200);
    expect(race.body.seed).toBe(1234);
    expect(race.body.botLevels).toEqual(['beginner', 'intermediate']);
    expect(race.body.results).toHaveLength(3);
    const expectedBots = createBots({ text: TEXT, levels: [...bots.levels], seed: bots.seed });
    const botNames = race.body.results
      .filter((r: { botName: string | null }) => r.botName)
      .map((r: { botName: string }) => r.botName);
    expect(botNames.sort()).toEqual(expectedBots.map((bot) => bot.profile.name).sort());
    const player = race.body.results.find(
      (r: { nickname: string | null }) => r.nickname === nickname,
    );
    expect(player.keystrokes.inputs).toBe(Array.from(stateText(run)).join(''));
  });

  it('perfil, estadísticas e historial reflejan los resultados guardados', async () => {
    for (const ms of [200, 160, 140]) {
      await http()
        .post('/results')
        .set(auth)
        .send(practicePayload(typeRun(TEXT, { msPerChar: ms })))
        .expect(201);
    }
    const profile = await http().get(`/users/${nickname.toUpperCase()}`).expect(200);
    expect(profile.body.stats.races).toBe(3);
    expect(profile.body.stats.bestWpm).toBeGreaterThan(profile.body.stats.averageWpm);

    const stats = await http().get(`/users/${nickname}/stats`).expect(200);
    expect(stats.body.history).toHaveLength(3);
    expect(stats.body.history[0].createdAt <= stats.body.history[2].createdAt).toBe(true);
    expect(stats.body.bestByMode).toEqual([expect.objectContaining({ mode: 'practice' })]);
    const keyE = stats.body.keys.find((k: { key: string }) => k.key === 'e');
    // El texto tiene cinco «e»: tres resultados suman 15 intentos.
    expect(keyE.attempts).toBe(15);

    const page1 = await http().get(`/users/${nickname}/races?limit=2`).expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).not.toBeNull();
    const page2 = await http()
      .get(`/users/${nickname}/races?limit=2&cursor=${page1.body.nextCursor}`)
      .expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();

    await http().get('/users/nadie-asi').expect(404);
  });

  it('migra los resultados del invitado y descarta los inválidos', async () => {
    const valid = practicePayload(typeRun(TEXT));
    const invalid = { ...practicePayload(typeRun(TEXT, { until: 5 })), content: TEXT };
    const response = await http()
      .post('/results/import')
      .set(auth)
      .send({ results: [valid, valid, invalid] })
      .expect(200);
    expect(response.body).toEqual({ imported: 2, rejected: 1 });
  });

  it('texto al azar: respeta idioma y no repite el excluido', async () => {
    const text = await http().get('/texts/random?language=es').expect(200);
    expect(text.body).toMatchObject({ id: 'es-test', language: 'es', type: 'quote' });
    await http().get('/texts/random?language=es&exclude=es-test').expect(404);
  });
});
