import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { applyInput, createTypingState, encodeKeystrokes, type TypingState } from '@tecleo/engine';
import type { SubmitResultInput } from '@tecleo/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return app;
}

export async function resetDatabase(app: INestApplication<App>): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "KeyStat", "RaceResult", "Race", "Session", "UserSettings", "User", "Text" CASCADE',
  );
}

let counter = 0;

export async function registerUser(app: INestApplication<App>, nickname = `jugador${++counter}`) {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: `${nickname}@example.com`, password: 'una-clave-segura', nickname })
    .expect(201);
  const body = response.body as { accessToken: string; user: { id: string; nickname: string } };
  return { ...body, cookie: refreshCookie(response.headers['set-cookie']) };
}

export function refreshCookie(header: string | string[] | undefined): string {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((value) => value.startsWith('tecleo_refresh='));
  if (!cookie) throw new Error('No llegó la cookie de refresh');
  return cookie.split(';')[0] ?? '';
}

/** Escribe `text` con el motor, con un ritmo humano irregular y determinista. */
export function typeRun(
  text: string,
  options: { startOn?: 'firstInput' | 'signal'; msPerChar?: number; until?: number } = {},
): TypingState {
  const { startOn = 'firstInput', msPerChar = 180, until = Number.POSITIVE_INFINITY } = options;
  let state = createTypingState({ text, startOn, rules: { mode: 'free' } });
  if (startOn === 'signal') state = { ...state, phase: 'running', startedAt: 0 };
  let t = 0;
  Array.from(text)
    .slice(0, until)
    .forEach((ch, index) => {
      if (index > 0) t += msPerChar * (0.6 + ((index * 7919) % 11) / 12);
      state = applyInput(state, { type: 'insert', text: ch }, t);
    });
  return state;
}

export function practicePayload(
  state: TypingState,
  overrides: Partial<SubmitResultInput> = {},
): SubmitResultInput {
  return {
    mode: 'practice',
    textId: null,
    content: state.words.map((word) => word.target + word.separator).join(''),
    preserveLines: false,
    language: 'es',
    rules: { mode: 'free', ignoreAccents: false },
    timeLimitMs: null,
    practiceKind: 'words',
    bots: null,
    keystrokes: encodeKeystrokes(state.keystrokes) as SubmitResultInput['keystrokes'],
    playedAt: new Date().toISOString(),
    ...overrides,
  };
}
