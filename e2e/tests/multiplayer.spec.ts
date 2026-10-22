import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Multijugador en tiempo real (Fase 5). Cada jugador es un contexto de navegador aparte: su
 * propio localStorage (invitado distinto), su propio socket y su propio reloj.
 */

const ROOM_URL = /\/es\/room\/([A-Z2-9]{6})$/;

async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function setGuestName(page: Page, name: string) {
  const field = page.getByLabel('Tu nombre en las carreras');
  await expect(field).toBeEnabled();
  await field.fill(name);
}

/** Crea una sala privada como invitado y devuelve su código. */
async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/es/room');
  await setGuestName(page, name);
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(page).toHaveURL(ROOM_URL);
  return ROOM_URL.exec(page.url())?.[1] ?? '';
}

async function joinRoom(page: Page, name: string, code: string) {
  await page.goto('/es/room');
  await setGuestName(page, name);
  // En minúsculas: el código no distingue mayúsculas.
  await page.getByLabel('Código de la sala').fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(`/es/room/${code}`);
}

const typingTarget = (page: Page) => page.locator('[data-typing-target]').filter({ visible: true });
const track = (page: Page) => page.getByRole('region', { name: 'Pista' });

async function waitForStart(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: '¡Ya!' })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Escribe con ritmo humano (intervalos irregulares, ~100 ppm): con intervalos idénticos el
 * antitrampa marcaría el resultado.
 */
async function typeLikeAPerson(page: Page, text: string, seed: number) {
  let state = seed;
  for (const char of text) {
    await page.keyboard.type(char);
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    await page.waitForTimeout(70 + (state % 90));
  }
}

test.describe('sala privada', () => {
  test('dos navegadores compiten en la misma sala, ven el progreso del otro y piden revancha', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ana = await newPlayer(browser);
    const beto = await newPlayer(browser);

    const code = await createRoom(ana, 'Ana');
    await expect(ana.getByRole('heading', { level: 1, name: `Sala ${code}` })).toBeVisible();
    // El anfitrión pide textos cortos; el otro ve la configuración sin poder cambiarla.
    await ana.getByRole('radio', { name: 'corto' }).click();
    await expect(ana.getByRole('radio', { name: 'corto' })).toBeChecked();

    await joinRoom(beto, 'Beto', code);
    for (const page of [ana, beto]) {
      await expect(page.getByRole('heading', { name: 'Jugadores (2/5)' })).toBeVisible();
      const players = page.getByRole('region', { name: 'Jugadores (2/5)' });
      await expect(players.getByText('Ana', { exact: false })).toBeVisible();
      await expect(players.getByText('Beto', { exact: false })).toBeVisible();
    }
    await expect(beto.getByText('Solo el anfitrión puede cambiarla.')).toBeVisible();
    await expect(beto.getByRole('radio', { name: 'corto' })).toBeChecked();
    await expect(beto.getByRole('radio', { name: 'corto' })).toBeDisabled();
    await expect(beto.getByRole('button', { name: 'Empezar ya' })).toHaveCount(0);

    // Con todos listos arranca la cuenta regresiva de 5 s en los dos a la vez.
    await ana.getByRole('button', { name: 'Estoy listo' }).click();
    await expect(
      beto.getByRole('region', { name: 'Jugadores (2/5)' }).getByText('Listo'),
    ).toBeVisible();
    await beto.getByRole('button', { name: 'Estoy listo' }).click();
    await Promise.all([waitForStart(ana), waitForStart(beto)]);

    const text = (await typingTarget(ana).textContent()) ?? '';
    expect(text.length).toBeGreaterThan(10);
    expect(await typingTarget(beto).textContent()).toBe(text);
    for (const page of [ana, beto]) await expect(track(page).getByRole('listitem')).toHaveCount(2);

    // Beto escribe la mitad: Ana lo ve avanzar en su pista.
    const half = Math.floor(text.length / 2);
    await typeLikeAPerson(beto, text.slice(0, half), 7);
    await expect(
      track(ana)
        .getByRole('listitem')
        .filter({ hasText: 'Beto' })
        .getByText(/^[1-9]\d* % del texto$/),
    ).toBeVisible();

    // Terminan los dos a la vez; el servidor decide el orden.
    await Promise.all([typeLikeAPerson(ana, text, 3), typeLikeAPerson(beto, text.slice(half), 11)]);
    const places = await Promise.all(
      [ana, beto].map(async (page) => {
        const status = page.getByRole('status').filter({ hasText: /^Puesto [12] de 2$/ });
        await expect(status).toBeVisible({ timeout: 15_000 });
        return (await status.textContent()) ?? '';
      }),
    );
    expect(places.sort()).toEqual(['Puesto 1 de 2', 'Puesto 2 de 2']);
    for (const [page, rival] of [
      [ana, 'Beto'],
      [beto, 'Ana'],
    ] as const) {
      const podium = page.getByRole('region', { name: 'Podio' });
      await expect(podium.getByRole('row')).toHaveCount(3);
      await expect(podium.getByRole('row').filter({ hasText: rival })).toBeVisible();
      await expect(page.getByText(/Sin cuenta, las carreras en línea no se guardan/)).toBeVisible();
    }

    // Revancha: la misma sala vuelve a la espera, con todos sin "listo".
    await ana.getByRole('button', { name: 'Revancha' }).click();
    for (const page of [ana, beto]) {
      await expect(page.getByRole('button', { name: 'Estoy listo' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: `Sala ${code}` })).toBeVisible();
    }
  });

  test('recargar en plena carrera vuelve a ella con lo escrito y se puede terminar', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const page = await newPlayer(browser);
    await createRoom(page, 'Carla');
    await page.getByRole('radio', { name: 'corto' }).click();
    await expect(page.getByRole('radio', { name: 'corto' })).toBeChecked();
    await page.getByRole('button', { name: 'Empezar ya' }).click();
    await waitForStart(page);

    const text = (await typingTarget(page).textContent()) ?? '';
    const typed = Math.min(12, Math.floor(text.length / 2));
    await typeLikeAPerson(page, text.slice(0, typed), 5);
    // Lo escrito se guarda en la pestaña con el mismo ritmo que el progreso (~120 ms).
    await page.waitForTimeout(400);

    await page.reload();
    await expect(typingTarget(page)).toHaveText(text);
    const self = track(page).getByRole('listitem').filter({ hasText: 'Carla' });
    await expect(self.getByText(/^[1-9]\d* % del texto$/)).toBeVisible();

    await typeLikeAPerson(page, text.slice(typed), 9);
    await expect(page.getByRole('status').filter({ hasText: /^Puesto 1 de 1$/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Tu resultado quedó marcado para revisión')).toHaveCount(0);
  });

  test('un código que no existe avisa y ofrece volver', async ({ page }) => {
    await page.goto('/es/room/ZZZZ22');
    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toContainText('No existe una sala con ese código');
    await alert.getByRole('link', { name: 'Volver' }).click();
    await expect(page).toHaveURL('/es/room');
  });

  test('el lobby no tiene violaciones de accesibilidad', async ({ page }) => {
    await createRoom(page, 'Dora');
    await expect(page.getByRole('heading', { name: 'Jugadores (1/5)' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

test('carrera pública: "Jugar ahora" busca rivales y completa con bots hasta cinco', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/es');
  await page.getByRole('link', { name: 'Jugar ahora' }).click();
  await expect(page).toHaveURL('/es/play');
  // Espera rivales o, si ya había una sala pública en cuenta regresiva, ocupa el lugar de un bot.
  await expect(
    page.getByRole('status').filter({ hasText: 'Buscando rivales…' }).or(track(page)),
  ).toBeVisible();
  await expect(track(page).getByRole('listitem')).toHaveCount(5, { timeout: 30_000 });
  await expect(track(page).getByText('(bot)').first()).toBeAttached();
});
