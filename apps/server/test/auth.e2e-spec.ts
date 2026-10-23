import type { INestApplication } from '@nestjs/common';
import { DEFAULT_SETTINGS } from '@tecleo/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, refreshCookie, registerUser, resetDatabase } from './helpers.js';

describe('autenticación', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });
  beforeEach(async () => {
    await resetDatabase(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('registro: devuelve el usuario, un access token y la cookie httpOnly de refresh', async () => {
    const response = await http()
      .post('/auth/register')
      .send({ email: '  Ana@Example.com ', password: 'una-clave-segura', nickname: 'Ana_92' })
      .expect(201);
    expect(response.body).toMatchObject({ user: { nickname: 'Ana_92', level: 1, xp: 0 } });
    expect(typeof response.body.accessToken).toBe('string');
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/tecleo_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rechaza correo o apodo repetidos (el apodo sin distinguir mayúsculas)', async () => {
    await registerUser(app, 'Repetido');
    const sameEmail = await http()
      .post('/auth/register')
      .send({ email: 'repetido@example.com', password: 'una-clave-segura', nickname: 'otro' })
      .expect(409);
    expect(sameEmail.body).toMatchObject({ code: 'EMAIL_TAKEN' });
    const sameNickname = await http()
      .post('/auth/register')
      .send({ email: 'nuevo@example.com', password: 'una-clave-segura', nickname: 'REPETIDO' })
      .expect(409);
    expect(sameNickname.body).toMatchObject({ code: 'NICKNAME_TAKEN' });
  });

  it('valida la entrada e indica los campos con problemas', async () => {
    const response = await http()
      .post('/auth/register')
      .send({ email: 'no-es-correo', password: 'corta', nickname: 'a' })
      .expect(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION' });
    expect(response.body.fields).toEqual(expect.arrayContaining(['email', 'password', 'nickname']));
  });

  it('login: credenciales incorrectas dan el mismo error exista o no el correo', async () => {
    await registerUser(app, 'login1');
    const wrongPassword = await http()
      .post('/auth/login')
      .send({ email: 'login1@example.com', password: 'otra-clave' })
      .expect(401);
    const unknownEmail = await http()
      .post('/auth/login')
      .send({ email: 'nadie@example.com', password: 'otra-clave' })
      .expect(401);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body.code).toBe('INVALID_CREDENTIALS');
    await http()
      .post('/auth/login')
      .send({ email: 'LOGIN1@example.com', password: 'una-clave-segura' })
      .expect(200);
  });

  it('refresh rota el token; reusar uno ya rotado revoca toda la sesión', async () => {
    const { cookie } = await registerUser(app);
    const first = await http().post('/auth/refresh').set('Cookie', cookie).expect(200);
    const rotated = refreshCookie(first.headers['set-cookie']);
    expect(rotated).not.toBe(cookie);

    // Alguien reusa el token viejo: se revoca la familia, incluido el token nuevo.
    const reuse = await http().post('/auth/refresh').set('Cookie', cookie).expect(401);
    expect(reuse.body.code).toBe('SESSION_EXPIRED');
    await http().post('/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('logout revoca la sesión y borra la cookie', async () => {
    const { cookie } = await registerUser(app);
    const response = await http().post('/auth/logout').set('Cookie', cookie).expect(204);
    expect(String(response.headers['set-cookie'])).toMatch(/tecleo_refresh=;/);
    await http().post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('/me exige un access token válido', async () => {
    const { accessToken, user } = await registerUser(app);
    await http().get('/me').expect(401);
    await http().get('/me').set('Authorization', 'Bearer basura').expect(401);
    const me = await http().get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.id).toBe(user.id);
  });

  it('preferencias: null hasta guardarlas, luego se devuelven validadas', async () => {
    const { accessToken } = await registerUser(app);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const empty = await http().get('/me/settings').set(auth).expect(200);
    expect(empty.body).toEqual({ settings: null });
    const settings = { ...DEFAULT_SETTINGS, theme: 'forest', keySound: 'click' };
    await http().put('/me/settings').set(auth).send(settings).expect(200);
    const saved = await http().get('/me/settings').set(auth).expect(200);
    expect(saved.body).toEqual({ settings });
  });

  it('avatar y país se pueden cambiar; los avatares bloqueados piden nivel', async () => {
    const { accessToken } = await registerUser(app);
    const response = await http()
      .patch('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatar: 'ink', country: 'CO' })
      .expect(200);
    expect(response.body).toMatchObject({ avatar: 'ink', country: 'CO', isAdmin: false });

    const locked = await http()
      .patch('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatar: 'forest' })
      .expect(403);
    expect(locked.body).toMatchObject({ code: 'LOCKED' });
  });

  it('limita los intentos de login por IP', async () => {
    const previous = process.env.AUTH_RATE_LIMIT;
    process.env.AUTH_RATE_LIMIT = '10';
    try {
      const statuses: number[] = [];
      let last: request.Response | undefined;
      for (let i = 0; i < 11; i++) {
        last = await http().post('/auth/login').send({ email: 'x@example.com', password: 'nope' });
        statuses.push(last.status);
      }
      // Los logins de pruebas anteriores cuentan en la misma ventana: el corte puede llegar antes.
      expect(statuses[0]).toBe(401);
      expect(statuses.indexOf(429)).toBeGreaterThan(0);
      expect(last?.status).toBe(429);
      expect(last?.body).toMatchObject({ code: 'RATE_LIMITED' });
    } finally {
      process.env.AUTH_RATE_LIMIT = previous;
    }
  });
});
