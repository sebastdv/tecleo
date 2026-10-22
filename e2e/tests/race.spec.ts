import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

interface RaceSetup {
  botCount: number;
  level: string;
  length: string;
}

/** Fija la configuración de la carrera antes de cargar la página y entra con una semilla. */
async function openRace(page: Page, seed: number, config: RaceSetup) {
  await page.addInitScript((value) => {
    localStorage.setItem('tecleo-race', JSON.stringify({ state: { config: value }, version: 1 }));
  }, config);
  await page.goto(`/es/race?seed=${seed}`);
  await expect(page.getByRole('status').filter({ hasText: /^[123]$/ })).toBeVisible();
}

async function raceText(page: Page): Promise<string> {
  return (await page.locator('[data-typing-target]').textContent()) ?? '';
}

const track = (page: Page) => page.getByRole('region', { name: 'Pista' });

test('carrera contra un bot principiante: cuenta regresiva, carrera, podio y revancha', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openRace(page, 3, { botCount: 1, level: 'beginner', length: 'short' });

  const lanes = track(page).getByRole('listitem');
  await expect(lanes).toHaveCount(2);
  await expect(lanes.nth(1)).toContainText('(bot)');

  // Durante la cuenta regresiva no se puede escribir.
  await page.keyboard.type('xyz', { delay: 20 });
  await expect(page.locator('[data-word-index] .text-error')).toHaveCount(0);

  await expect(page.getByRole('status').filter({ hasText: '¡Ya!' })).toBeVisible({
    timeout: 5_000,
  });
  const text = await raceText(page);
  await page.keyboard.type(text, { delay: 25 });

  await expect(page.getByText('Puesto 1 de 2')).toBeVisible();
  const podium = page.getByRole('region', { name: 'Podio' });
  await expect(podium.getByRole('table')).toBeVisible();
  await expect(podium.getByRole('row')).toHaveCount(3);

  await page.getByRole('button', { name: 'Revancha' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^[123]$/ })).toBeVisible();
  expect(await raceText(page)).toBe(text);
});

test('un bot que llega antes muestra su puesto en la pista y el jugador queda segundo', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openRace(page, 11, { botCount: 1, level: 'legend', length: 'short' });
  await expect(page.getByRole('status').filter({ hasText: '¡Ya!' })).toBeVisible({
    timeout: 5_000,
  });

  const botLane = track(page).getByRole('listitem').nth(1);
  await expect(botLane).toContainText('1.º', { timeout: 20_000 });

  await page.keyboard.type(await raceText(page), { delay: 10 });
  await expect(page.getByText('Puesto 2 de 2')).toBeVisible();
});

test('Esc abandona la carrera y vuelve a las opciones', async ({ page }) => {
  await openRace(page, 5, { botCount: 2, level: 'intermediate', length: 'short' });
  await expect(page.getByRole('status').filter({ hasText: '¡Ya!' })).toBeVisible({
    timeout: 5_000,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Empezar carrera' })).toBeVisible();
});

test('la configuración elegida decide cuántos bots corren', async ({ page }) => {
  await page.goto('/es/race');
  await page.getByRole('radio', { name: '5' }).click();
  await page.getByRole('radio', { name: 'mixta' }).click();
  await expect(page.getByText('Cada bot con un nivel distinto, al azar.')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar carrera' }).click();
  await expect(track(page).getByRole('listitem')).toHaveCount(6);
});

test('la carrera y sus resultados no tienen violaciones de accesibilidad', async ({ page }) => {
  test.setTimeout(60_000);
  await openRace(page, 7, { botCount: 2, level: 'beginner', length: 'short' });
  await expect(page.getByRole('status').filter({ hasText: '¡Ya!' })).toBeVisible({
    timeout: 5_000,
  });
  const during = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(during.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.keyboard.type(await raceText(page), { delay: 15 });
  await expect(page.getByRole('region', { name: 'Podio' })).toBeVisible();
  await page.waitForTimeout(1_000);
  const after = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(after.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
