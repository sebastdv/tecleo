import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  field,
  grantAdmin,
  newAccount,
  register,
  typeLikeAHuman,
  typingTarget,
} from './support.js';

/**
 * Fase 6: progresión, repeticiones, fantasma, desafío diario, rankings, calificación,
 * práctica dirigida y panel de textos.
 */

const insights = (page: Page) => page.getByRole('region', { name: 'Tu progreso' });

async function playTenWords(page: Page, seed: number) {
  await page.goto(`/es/practice?seed=${seed}`);
  await page.getByRole('button', { name: 'palabras', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await expect(field(page, 'Texto a escribir')).toBeFocused();
  await typeLikeAHuman(page, await typingTarget(page));
  await expect(page.getByRole('region', { name: 'Resultados' })).toBeVisible();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  // Con los selectores de cada nodo: el fallo dice dónde está el problema.
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

test('con cuenta, una prueba suma XP y logros, se ve en el perfil y se puede repetir', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const account = newAccount();
  await register(page, account);
  await playTenWords(page, 61);

  await expect(insights(page).getByText(/^\+\d+ XP$/)).toBeVisible();
  await expect(insights(page).getByText('Primera prueba', { exact: true })).toBeVisible();
  await expect(insights(page).getByText('Nivel 1')).toBeVisible();

  // Repetición pulsación por pulsación.
  await insights(page).getByRole('link', { name: 'Ver repetición' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Repetición de ${account.nickname}` }),
  ).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Momento de la repetición' });
  await expect(slider).toHaveValue('0');
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await expect
    .poll(async () => Number(await slider.inputValue()), { timeout: 5_000 })
    .toBeGreaterThan(300);
  await expectNoAxeViolations(page);

  // El perfil muestra el nivel, la XP y los logros.
  await page.goto(`/es/profile/${account.nickname}`);
  await expect(page.getByRole('progressbar', { name: 'Progreso hacia el nivel 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Logros \(\d+\/17\)$/ })).toBeVisible();
  await expect(page.getByText('Termina tu primera prueba.')).toBeVisible();
  await expectNoAxeViolations(page);

  // Desde el historial: correr contra la propia prueba.
  await page.getByRole('link', { name: 'Fantasma', exact: true }).first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Contra el fantasma de ${account.nickname}` }),
  ).toBeVisible();
  const track = page.getByRole('region', { name: 'Pista' });
  await expect(track.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: '¡Ya!' })).toBeVisible({
    timeout: 6_000,
  });
  await typeLikeAHuman(page, await typingTarget(page), 120);
  await expect(
    page.getByRole('status').filter({ hasText: /Le ganaste al fantasma|llegó antes/ }),
  ).toBeVisible();
  await expect(insights(page).getByText(/^\+\d+ XP$/)).toBeVisible();
});

test('desafío diario: el mismo texto para todos, con su ranking y su logro', async ({ page }) => {
  test.setTimeout(90_000);
  const account = newAccount();
  await register(page, account);
  await page.goto('/es/daily');
  await expect(page.getByText(/^Desafío del /)).toBeVisible();
  const text = await typingTarget(page);
  expect(text.length).toBeGreaterThan(50);

  await field(page, 'Texto a escribir').focus();
  await typeLikeAHuman(page, text);
  await expect(insights(page).getByText('Desafío del día')).toBeVisible();
  const ranking = page.getByRole('region', { name: 'Ranking de hoy' });
  await expect(ranking.getByRole('link', { name: account.nickname, exact: true })).toBeVisible();

  // Rankings generales: hoy, en español, en el modo del desafío.
  await page.goto('/es/leaderboards');
  await page.getByRole('radio', { name: 'Hoy' }).click();
  await page.getByRole('combobox', { name: 'Modo' }).click();
  await page.getByRole('option', { name: 'Desafío diario' }).click();
  await expect(page.getByRole('link', { name: account.nickname, exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('calificar el texto y ver su ranking', async ({ page }) => {
  test.setTimeout(90_000);
  const account = newAccount();
  await register(page, account);
  await page.goto('/es/daily');
  await field(page, 'Texto a escribir').focus();
  await typeLikeAHuman(page, await typingTarget(page));

  const like = insights(page).getByRole('button', { name: 'Me gustó', exact: true });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');

  await insights(page).getByRole('link', { name: 'Ranking de este texto' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ranking del texto' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Me gustó', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(/^\d+ les? gustó$/)).toBeVisible();
  await expect(page.getByRole('link', { name: account.nickname, exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('práctica dirigida: los errores del invitado arman el ejercicio', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/es/targeted');
  await expect(page.getByText('Todavía no hay suficientes datos')).toBeVisible();

  // Una práctica con errores en la «e» (se escribe «x», se borra y se corrige).
  await page.goto('/es/practice?seed=71');
  await page.getByRole('button', { name: 'palabras', exact: true }).click();
  await page.getByRole('button', { name: '25', exact: true }).click();
  await expect(field(page, 'Texto a escribir')).toBeFocused();
  for (const ch of await typingTarget(page)) {
    if (ch === 'e') {
      await page.keyboard.type('x');
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.type(ch);
    await page.waitForTimeout(60);
  }
  await expect(page.getByRole('region', { name: 'Resultados' })).toBeVisible();

  await page.goto('/es/targeted');
  const focus = page.getByRole('region', { name: 'Esta vez practicas' });
  await expect(focus.getByText('e', { exact: true })).toBeVisible();
  const exercise = await typingTarget(page);
  expect(exercise.split(' ')).toHaveLength(30);
  expect(exercise.split(' ').every((word) => /e/i.test(word))).toBe(true);
  await field(page, 'Texto a escribir').focus();
  await typeLikeAHuman(page, exercise);
  await expect(page.getByRole('button', { name: 'Otro ejercicio' })).toBeVisible();
  // Las cifras entran con una animación de opacidad: se revisa el contraste ya quietas.
  await page.waitForTimeout(1_000);
  await expectNoAxeViolations(page);
});

test('panel de textos: solo administradores agregan y desactivan textos', async ({ page }) => {
  const account = newAccount();
  await register(page, account);
  await page.goto('/es/admin');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Esta sección es solo para administradores.',
  );

  grantAdmin(account.email);
  // El rol se lee al iniciar sesión: una recarga trae la cuenta con él.
  await page.reload();
  await page.getByRole('button', { name: `Cuenta: ${account.nickname}` }).click();
  await page.getByRole('menuitem', { name: 'Textos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Textos' })).toBeVisible();

  const content = `Texto escrito para las pruebas de ${account.nickname}, con su punto final.`;
  await page.getByLabel('Texto', { exact: true }).filter({ visible: true }).fill(content);
  await page.getByLabel('Autor', { exact: true }).filter({ visible: true }).fill('Tecleo');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Texto agregado.')).toBeVisible();

  await page
    .getByRole('searchbox', { name: 'Buscar en el texto o el autor' })
    .fill(account.nickname);
  const row = page.getByRole('row').filter({ hasText: content });
  await expect(row).toHaveCount(1);
  const toggle = row.getByRole('switch');
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expectNoAxeViolations(page);
});
