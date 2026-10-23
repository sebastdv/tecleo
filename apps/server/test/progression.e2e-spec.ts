import type { INestApplication } from '@nestjs/common';
import { encodeKeystrokes, type TypingState } from '@tecleo/engine';
import type { SubmitResultInput } from '@tecleo/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createApp, practicePayload, registerUser, resetDatabase, typeRun } from './helpers.js';

const TEXT = 'El que lee mucho y anda mucho, ve mucho y sabe mucho por los caminos del mundo.';
const OTHER = 'Las cosas de la tierra no se quedan quietas: todo se mueve y cambia con los años.';

describe('progresión, rankings, diario, fantasma, calificación y textos', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDatabase(app);
    await prisma.text.createMany({
      data: [
        { id: 'es-a', content: TEXT },
        { id: 'es-b', content: OTHER },
      ].map((text) => ({
        ...text,
        language: 'es',
        type: 'quote' as const,
        length: text.content.length,
        lengthCategory: 'short',
        difficulty: 20,
      })),
    });
  });
  afterAll(async () => {
    await app.close();
  });

  async function player() {
    const user = await registerUser(app);
    return { ...user, auth: { Authorization: `Bearer ${user.accessToken}` } };
  }

  function textPayload(
    run: TypingState,
    textId: string,
    overrides: Partial<SubmitResultInput> = {},
  ): SubmitResultInput {
    return practicePayload(run, { textId, practiceKind: 'text', ...overrides });
  }

  describe('XP, nivel y logros', () => {
    it('cada resultado suma XP, entrega logros nuevos y compara con las marcas previas', async () => {
      const { auth, user } = await player();
      const first = await http()
        .post('/results')
        .set(auth)
        .send(textPayload(typeRun(TEXT, { msPerChar: 140 }), 'es-a'))
        .expect(201);
      expect(first.body.progress).toMatchObject({
        leveledUp: false,
        previousAverageWpm: null,
        previousBestWpm: null,
        previousTextBestWpm: null,
      });
      expect(first.body.progress.xpGained).toBeGreaterThan(0);
      expect(first.body.progress.achievements).toContain('first-race');

      const second = await http()
        .post('/results')
        .set(auth)
        .send(textPayload(typeRun(TEXT, { msPerChar: 200 }), 'es-a'))
        .expect(201);
      expect(second.body.progress.achievements).not.toContain('first-race');
      expect(second.body.progress.previousTextBestWpm).toBeCloseTo(first.body.wpm, 6);
      expect(second.body.progress.previousAverageWpm).toBeCloseTo(first.body.wpm, 6);
      const xpOf = (body: unknown) => (body as { progress: { xpGained: number } }).progress;
      expect(second.body.progress.xp).toBe(xpOf(first.body).xpGained + xpOf(second.body).xpGained);

      const profile = await http().get(`/users/${user.nickname}`).expect(200);
      expect(profile.body.xp).toBe(second.body.progress.xp);
      expect(profile.body.achievements.map((a: { id: string }) => a.id)).toContain('first-race');
    });

    it('un resultado marcado no suma XP', async () => {
      const { auth } = await player();
      // 2 000 ppm: imposible para una persona.
      const response = await http()
        .post('/results')
        .set(auth)
        .send(textPayload(typeRun(TEXT, { msPerChar: 6 }), 'es-a'))
        .expect(201);
      expect(response.body.flagged).toBe(true);
      expect(response.body.progress.xpGained).toBe(0);
    });
  });

  describe('rankings', () => {
    it('la mejor marca limpia de cada persona, por idioma, modo y periodo', async () => {
      const ana = await player();
      const beto = await player();
      for (const [who, ms] of [
        [ana, 200],
        [ana, 150],
        [beto, 170],
      ] as const) {
        await http()
          .post('/results')
          .set(who.auth)
          .send(textPayload(typeRun(TEXT, { msPerChar: ms }), 'es-a'))
          .expect(201);
      }
      // Marcado: no entra aunque sea el más rápido.
      await http()
        .post('/results')
        .set(beto.auth)
        .send(textPayload(typeRun(TEXT, { msPerChar: 6 }), 'es-a'))
        .expect(201);

      const week = await http().get('/leaderboards?period=week&language=es').expect(200);
      expect(week.body.entries.map((e: { nickname: string }) => e.nickname)).toEqual([
        ana.user.nickname,
        beto.user.nickname,
      ]);
      expect(week.body.entries[0]).toMatchObject({ rank: 1, mode: 'practice' });
      expect(week.body.entries[0].wpm).toBeGreaterThan(week.body.entries[1].wpm);

      const english = await http().get('/leaderboards?language=en').expect(200);
      expect(english.body.entries).toEqual([]);
      const bots = await http().get('/leaderboards?mode=bots').expect(200);
      expect(bots.body.entries).toEqual([]);

      // Un resultado de hace dos días sale del diario pero no del semanal.
      await prisma.raceResult.updateMany({
        where: { userId: ana.user.id },
        data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
      });
      const day = await http().get('/leaderboards?period=day').expect(200);
      expect(day.body.entries.map((e: { nickname: string }) => e.nickname)).toEqual([
        beto.user.nickname,
      ]);

      const byText = await http().get('/texts/es-a/leaderboard').expect(200);
      expect(byText.body.text).toMatchObject({ id: 'es-a', likes: 0, dislikes: 0 });
      expect(byText.body.entries).toHaveLength(2);
      await http().get('/texts/es-b/leaderboard').expect(200);
      await http().get('/texts/nada/leaderboard').expect(404);
      await http().get('/leaderboards?period=year').expect(400);
    });
  });

  describe('desafío diario', () => {
    it('el mismo texto para todos el mismo día; solo ese texto cuenta como diario', async () => {
      const { auth, user } = await player();
      const first = await http().get('/daily?language=es').expect(200);
      const again = await http().get('/daily?language=es').expect(200);
      expect(again.body.text.id).toBe(first.body.text.id);
      expect(first.body.date).toBe(new Date().toISOString().slice(0, 10));

      const dailyId: string = first.body.text.id;
      const otherId = dailyId === 'es-a' ? 'es-b' : 'es-a';
      const content = (id: string) => (id === 'es-a' ? TEXT : OTHER);
      const wrong = await http()
        .post('/results')
        .set(auth)
        .send(
          textPayload(typeRun(content(otherId)), otherId, { mode: 'daily', practiceKind: null }),
        )
        .expect(422);
      expect(wrong.body.code).toBe('NOT_DAILY');

      const ok = await http()
        .post('/results')
        .set(auth)
        .send(
          textPayload(typeRun(content(dailyId)), dailyId, { mode: 'daily', practiceKind: null }),
        )
        .expect(201);
      expect(ok.body.mode).toBe('daily');
      expect(ok.body.progress.achievements).toContain('daily-first');

      const ranking = await http().get('/daily?language=es').expect(200);
      expect(ranking.body.entries).toHaveLength(1);
      expect(ranking.body.entries[0]).toMatchObject({ nickname: user.nickname, mode: 'daily' });
    });
  });

  describe('carrera fantasma', () => {
    it('se corre contra las pulsaciones de otro resultado y gana quien tarda menos', async () => {
      const ana = await player();
      const beto = await player();
      const slow = await http()
        .post('/results')
        .set(ana.auth)
        .send(textPayload(typeRun(TEXT, { msPerChar: 220 }), 'es-a'))
        .expect(201);

      const ghostRun = (msPerChar: number) =>
        textPayload(typeRun(TEXT, { msPerChar, startOn: 'signal' }), 'es-a', {
          mode: 'ghost',
          practiceKind: null,
          ghostResultId: slow.body.id,
        });
      const win = await http().post('/results').set(beto.auth).send(ghostRun(150)).expect(201);
      expect(win.body).toMatchObject({ mode: 'ghost', position: 1, runners: 2 });
      expect(win.body.progress.achievements).toContain('ghost-first');

      const lose = await http().post('/results').set(beto.auth).send(ghostRun(300)).expect(201);
      expect(lose.body.position).toBe(2);

      const wrongText = {
        ...ghostRun(150),
        textId: 'es-b',
        content: OTHER,
        keystrokes: encodeKeystrokes(typeRun(OTHER, { startOn: 'signal' }).keystrokes),
      };
      const mismatch = await http().post('/results').set(beto.auth).send(wrongText).expect(422);
      expect(mismatch.body.code).toBe('TEXT_MISMATCH');

      const missing = { ...ghostRun(150), ghostResultId: '01900000-0000-7000-8000-000000000000' };
      await http().post('/results').set(beto.auth).send(missing).expect(404);

      // La repetición trae las pulsaciones del fantasma.
      const race = await http().get(`/races/${slow.body.raceId}`).expect(200);
      expect(race.body.results[0].keystrokes.deltas.length).toBeGreaterThan(10);
      const byResult = await http().get(`/races/by-result/${slow.body.id}`).expect(200);
      expect(byResult.body.id).toBe(slow.body.raceId);
    });
  });

  describe('calificar textos', () => {
    it('👍, 👎 y quitar; los totales se recuentan', async () => {
      const ana = await player();
      const beto = await player();
      await http().put('/texts/es-a/rating').send({ value: 1 }).expect(401);

      await http().put('/texts/es-a/rating').set(ana.auth).send({ value: 1 }).expect(200);
      await http().put('/texts/es-a/rating').set(ana.auth).send({ value: 1 }).expect(200);
      const both = await http()
        .put('/texts/es-a/rating')
        .set(beto.auth)
        .send({ value: -1 })
        .expect(200);
      expect(both.body).toEqual({ value: -1, likes: 1, dislikes: 1 });

      const changed = await http()
        .put('/texts/es-a/rating')
        .set(ana.auth)
        .send({ value: 0 })
        .expect(200);
      expect(changed.body).toEqual({ value: 0, likes: 0, dislikes: 1 });
      const mine = await http().get('/texts/es-a/rating').set(beto.auth).expect(200);
      expect(mine.body).toEqual({ value: -1, likes: 0, dislikes: 1 });

      await http().put('/texts/es-a/rating').set(ana.auth).send({ value: 2 }).expect(400);
      await http().put('/texts/nada/rating').set(ana.auth).send({ value: 1 }).expect(404);
    });
  });

  describe('panel de textos', () => {
    it('solo administradores agregan, listan y desactivan textos', async () => {
      const admin = await player();
      await http().get('/admin/texts').expect(401);
      await http().get('/admin/texts').set(admin.auth).expect(403);
      await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'admin' } });

      const me = await http().get('/me').set(admin.auth).expect(200);
      expect(me.body.isAdmin).toBe(true);

      const created = await http()
        .post('/admin/texts')
        .set(admin.auth)
        .send({
          content: '  Un texto escrito para el proyecto, con su punto final.  ',
          language: 'es',
          type: 'quote',
          author: '',
          source: 'Tecleo',
        })
        .expect(201);
      expect(created.body).toMatchObject({
        content: 'Un texto escrito para el proyecto, con su punto final.',
        author: null,
        source: 'Tecleo',
        active: true,
        lengthCategory: 'short',
      });
      expect(created.body.id).toMatch(/^es-u[0-9a-f]{8}$/);

      const search = await http().get('/admin/texts?q=proyecto').set(admin.auth).expect(200);
      expect(search.body).toMatchObject({ total: 1, page: 1, pages: 1 });

      const off = await http()
        .patch(`/admin/texts/${created.body.id}`)
        .set(admin.auth)
        .send({ active: false })
        .expect(200);
      expect(off.body.active).toBe(false);
      const inactive = await http().get('/admin/texts?active=false').set(admin.auth).expect(200);
      expect(inactive.body.items.map((t: { id: string }) => t.id)).toEqual([created.body.id]);

      await http()
        .post('/admin/texts')
        .set(admin.auth)
        .send({ content: 'corto', language: 'es', type: 'quote', author: null, source: null })
        .expect(400);
      await http().patch('/admin/texts/nada').set(admin.auth).send({ active: false }).expect(404);
    });
  });
});
