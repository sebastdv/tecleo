import { expect, test, type Page } from '@playwright/test';

/** El texto completo a escribir está en un nodo solo para lectores de pantalla. */
async function targetText(page: Page): Promise<string> {
  return (await page.locator('#typing-target').textContent()) ?? '';
}

async function openWordsPractice(page: Page, seed: number, count: '10' | '25' = '10') {
  await page.goto(`/practice?seed=${seed}`);
  await page.getByRole('button', { name: 'palabras', exact: true }).click();
  await page.getByRole('button', { name: count, exact: true }).click();
  await expect(page.getByLabel('Texto a escribir')).toBeFocused();
}

const typingInput = (page: Page) => page.getByLabel('Texto a escribir');
const results = (page: Page) => page.getByRole('region', { name: 'Resultados' });
const accuracy = (page: Page) => results(page).locator('dt:text-is("precisión") + dd');

test('práctica por palabras: escribir el texto completo muestra los resultados', async ({
  page,
}) => {
  await openWordsPractice(page, 7);
  const text = await targetText(page);
  expect(text.split(' ')).toHaveLength(10);

  await page.keyboard.type(text, { delay: 40 });

  await expect(results(page)).toBeVisible();
  await expect(accuracy(page)).toHaveText('100%');
  await expect(page.getByLabel('Gráfica de WPM por segundo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente texto' })).toBeFocused();
});

test('la misma semilla produce el mismo texto', async ({ page }) => {
  await openWordsPractice(page, 99);
  const first = await targetText(page);
  await openWordsPractice(page, 99);
  expect(await targetText(page)).toBe(first);
});

test('teclas muertas: la composición ´ + e cuenta como una sola é', async ({ page }) => {
  await openWordsPractice(page, 7);
  const text = await targetText(page);
  const index = text.indexOf('é');
  expect(index, 'la semilla 7 genera "después"').toBeGreaterThan(0);

  await page.keyboard.type(text.slice(0, index), { delay: 20 });
  // Lo que emite el navegador con una tecla muerta en macOS o Linux.
  await typingInput(page).evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    element.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertCompositionText',
        data: '´',
        isComposing: true,
        cancelable: true,
      }),
    );
    element.dispatchEvent(new CompositionEvent('compositionend', { data: 'é' }));
  });
  await page.keyboard.type(text.slice(index + 1), { delay: 20 });

  await expect(accuracy(page)).toHaveText('100%');
});

test('los errores bajan la precisión y el backspace los corrige', async ({ page }) => {
  await openWordsPractice(page, 7);
  const text = await targetText(page);

  await page.keyboard.type('x', { delay: 40 });
  await expect(page.locator('[data-word-index="0"] > span').first()).toHaveClass(/text-rose-400/);
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: 30 });

  await expect(results(page)).toBeVisible();
  await expect(accuracy(page)).not.toHaveText('100%');
});

test('pegar está bloqueado', async ({ page }) => {
  await openWordsPractice(page, 7);
  const text = await targetText(page);
  await typingInput(page).evaluate((element, data) => {
    element.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertFromPaste', data, cancelable: true }),
    );
  }, text);
  await expect(page.locator('.text-zinc-100')).toHaveCount(0);
  await expect(results(page)).toHaveCount(0);
});

test('al perder el foco aparece el aviso y una tecla lo devuelve', async ({ page }) => {
  await openWordsPractice(page, 7);
  const text = await targetText(page);
  await page.keyboard.type(text.slice(0, 3), { delay: 30 });

  await typingInput(page).blur();
  const overlay = page.getByRole('button', {
    name: 'Haz clic o presiona una tecla para continuar',
  });
  await expect(overlay).toBeVisible();

  await page.keyboard.type(text.slice(3), { delay: 30 });
  await expect(overlay).toHaveCount(0);
  await expect(results(page)).toBeVisible();
});

test('modo por tiempo: termina solo al cumplirse los 15 s', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/practice?seed=5');
  await page.getByRole('button', { name: '15s', exact: true }).click();
  await expect(typingInput(page)).toBeFocused();
  const words = (await targetText(page)).split(' ').slice(0, 5).join(' ');

  await page.keyboard.type(`${words} `, { delay: 60 });
  await expect(results(page)).toBeVisible({ timeout: 20_000 });
  await expect(results(page).getByText('15.0 s')).toBeVisible();
});

test('Tab + Enter prepara un texto nuevo', async ({ page }) => {
  await openWordsPractice(page, 7);
  const before = await targetText(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Nuevo texto/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => targetText(page)).not.toBe(before);
  await expect(typingInput(page)).toBeFocused();
});
