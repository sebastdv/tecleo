import { expect, test } from '@playwright/test';

import { typingTarget } from './support.js';

/** Responsive básico (spec 13): un teléfono de 390 px de ancho, táctil. */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const PAGES = [
  '/es',
  '/es/practice',
  '/es/race',
  '/es/play',
  '/es/room',
  '/es/daily',
  '/es/targeted',
  '/es/leaderboards',
  '/es/settings',
  '/es/login',
] as const;

for (const path of PAGES) {
  test(`${path} entra en el ancho de un teléfono, sin desplazamiento horizontal`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    // Lo que no entra (tablas) se desplaza dentro de su contenedor, nunca la página entera.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('el menú móvil lleva a cada sección', async ({ page }) => {
  await page.goto('/es');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden();
  await page.getByRole('button', { name: 'Abrir menú' }).tap();
  await page.getByRole('dialog').getByRole('link', { name: 'Rankings' }).tap();
  await expect(page).toHaveURL('/es/leaderboards');
  await expect(page.getByRole('heading', { level: 1, name: 'Rankings' })).toBeVisible();
});

test('en un teléfono avisa que conviene un teclado y se puede practicar igual', async ({
  page,
}) => {
  await page.goto('/es/practice?seed=5');
  await expect(
    page
      .getByText(/teclado/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'palabras', exact: true }).tap();
  await page.getByRole('button', { name: '10', exact: true }).tap();
  // El textarea que recibe el teclado es invisible: se toca el texto, que le pasa el foco.
  await page.locator('[data-word-index="0"]').filter({ visible: true }).tap();
  await page.keyboard.type(await typingTarget(page), { delay: 30 });
  await expect(page.getByRole('region', { name: 'Resultados' })).toBeVisible();
});
