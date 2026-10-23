import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { field, newAccount, register, typeLikeAHuman } from './support.js';

async function playTenWords(page: Page, seed: number) {
  await page.goto(`/es/practice?seed=${seed}`);
  await page.getByRole('button', { name: 'palabras', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await expect(field(page, 'Texto a escribir')).toBeFocused();
  await typeLikeAHuman(page, (await page.locator('[data-typing-target]').textContent()) ?? '');
  await expect(page.getByRole('region', { name: 'Resultados' })).toBeVisible();
}

test('registro, cierre de sesión y entrada de nuevo', async ({ page }) => {
  const account = newAccount();
  await register(page, account);

  // La sesión sobrevive a una recarga (cookie de refresh httpOnly).
  await page.reload();
  await expect(page.getByRole('button', { name: `Cuenta: ${account.nickname}` })).toBeVisible();
  expect(await page.evaluate(() => document.cookie)).not.toContain('tecleo_refresh');

  await page.getByRole('button', { name: `Cuenta: ${account.nickname}` }).click();
  await page.getByRole('menuitem', { name: 'Salir' }).click();
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();

  await page.getByRole('link', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await field(page, 'Correo electrónico').fill(account.email);
  await field(page, 'Contraseña').fill('una-clave-equivocada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Correo o contraseña incorrectos.',
  );
  await field(page, 'Contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: `Cuenta: ${account.nickname}` })).toBeVisible();
});

test('el registro valida los campos y avisa si el apodo está ocupado', async ({
  page,
  browser,
}) => {
  const account = newAccount();
  await page.goto('/es/register');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Escribe un correo válido.')).toBeVisible();
  await expect(field(page, 'Correo electrónico')).toHaveAttribute('aria-invalid', 'true');

  await register(page, account);
  const other = await browser.newPage();
  await other.goto('/es/register');
  await field(other, 'Apodo').fill(account.nickname.toUpperCase());
  await field(other, 'Correo electrónico').fill(`otro_${account.email}`);
  await field(other, 'Contraseña').fill(account.password);
  await other.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(other.getByRole('main').getByRole('alert')).toHaveText('Ese apodo ya está en uso.');
});

test('los resultados del invitado se migran al registrarse y aparecen en el perfil', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await playTenWords(page, 31);
  await expect(page.getByText(/Resultado guardado en este navegador/)).toBeVisible();

  const account = newAccount();
  await page.goto('/es/register');
  await expect(
    page.getByRole('checkbox', { name: /el resultado que jugué como invitado/ }),
  ).toBeChecked();
  await register(page, account);

  await page.goto(`/es/profile/${account.nickname}`);
  await expect(page.getByRole('heading', { level: 1, name: account.nickname })).toBeVisible();
  const history = page.getByRole('table');
  await expect(history.getByRole('row')).toHaveCount(2);
  await expect(history).toContainText('Práctica');
});

test('con sesión, el resultado se guarda en el perfil con estadísticas y mapa de teclas', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const account = newAccount();
  await register(page, account, false);
  await playTenWords(page, 32);
  await expect(page.getByText('Resultado guardado en tu perfil.')).toBeVisible();

  await page.getByRole('button', { name: `Cuenta: ${account.nickname}` }).click();
  await page.getByRole('menuitem', { name: 'Mi perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Evolución' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Teclas con más errores' })).toBeVisible();
  await expect(page.getByText('pruebas', { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('las preferencias se guardan en la cuenta y viajan a otro navegador', async ({
  page,
  browser,
}) => {
  const account = newAccount();
  await register(page, account, false);
  await page.getByRole('button', { name: 'Tema' }).click();
  await page.getByRole('menuitemradio', { name: 'Bosque' }).click();
  // El guardado en el servidor espera un momento tras el último cambio.
  await page.waitForTimeout(1_500);

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto('/es/login');
  await field(other, 'Correo electrónico').fill(account.email);
  await field(other, 'Contraseña').fill(account.password);
  await other.getByRole('button', { name: 'Entrar' }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'forest');
  await context.close();
});

test('avatar y país se cambian desde Configuración', async ({ page }) => {
  const account = newAccount();
  await register(page, account, false);
  await page.goto('/es/settings');
  await page
    .getByRole('radiogroup', { name: 'Avatar' })
    .getByRole('radio', { name: 'Tinta' })
    .click();
  await expect(page.getByText('Guardado.')).toBeVisible();
  // Los demás acabados se desbloquean con nivel o logros.
  await expect(
    page.getByRole('radiogroup', { name: 'Avatar' }).getByRole('radio', { name: 'Bosque' }),
  ).toBeDisabled();
  await field(page, 'País').click();
  await page.getByRole('option', { name: 'Colombia' }).click();
  await page.goto(`/es/profile/${account.nickname}`);
  await expect(page.getByRole('img', { name: 'CO' })).toBeVisible();
});

test('un perfil inexistente lo dice claramente', async ({ page }) => {
  await page.goto('/es/profile/nadie-con-este-apodo-123');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'No existe un jugador con ese apodo.',
  );
});
