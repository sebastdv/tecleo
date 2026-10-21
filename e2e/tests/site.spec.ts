import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/es',
  '/es/practice',
  '/es/race',
  '/es/leaderboards',
  '/es/settings',
  '/es/login',
  '/es/register',
  '/es/room/ab12cd',
  '/es/profile/ana',
  '/es/no-existe',
  '/en',
  '/en/practice',
  '/en/settings',
] as const;

test.describe('navegación', () => {
  test.describe('con el navegador en español', () => {
    test.use({ locale: 'es-CO' });
    test('la raíz redirige a /es', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/es$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    });
  });

  test.describe('con el navegador en inglés', () => {
    test.use({ locale: 'en-US' });
    test('la raíz redirige a /en', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/en$/);
    });
  });

  test('desde el menú se llega a cada pantalla principal', async ({ page }) => {
    await page.goto('/es');
    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    for (const [name, path, heading] of [
      ['Practicar', '/es/practice', 'Práctica'],
      ['Carreras', '/es/race', 'Carreras'],
      ['Rankings', '/es/leaderboards', 'Rankings'],
    ] as const) {
      await nav.getByRole('link', { name }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached();
      await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    }
    await page.getByRole('link', { name: 'Configuración' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Configuración' })).toBeVisible();
    await page.getByRole('link', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    await page.getByRole('link', { name: 'Crea una' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible();
    await page.getByRole('link', { name: 'Inicio: Tecleo' }).click();
    await expect(page).toHaveURL(/\/es$/);
  });

  test('jugar ahora lleva a la práctica', async ({ page }) => {
    await page.goto('/es');
    await page.getByRole('link', { name: 'Jugar ahora' }).click();
    await expect(page).toHaveURL('/es/practice');
  });

  test('una ruta desconocida muestra el 404 localizado', async ({ page }) => {
    const response = await page.goto('/en/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: "This page doesn't exist" })).toBeVisible();
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test('el enlace "saltar al contenido" es el primer elemento enfocable', async ({ page }) => {
    await page.goto('/es');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });
});

test.describe('idioma', () => {
  test('cambiar el idioma conserva la página y traduce la interfaz', async ({ page }) => {
    await page.goto('/es/settings');
    await page.getByRole('button', { name: 'Idioma de la interfaz' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL('/en/settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });
});

test.describe('temas y configuración', () => {
  test('el tema cambia al instante y se recuerda al recargar', async ({ page }) => {
    await page.goto('/es');
    await page.getByRole('button', { name: 'Tema' }).click();
    await page.getByRole('menuitemradio', { name: 'Día' }).click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'day');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 250)');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'day');
  });

  test('tipografía y tamaño elegidos se aplican al texto de la práctica', async ({ page }) => {
    await page.goto('/es/settings');
    await page.getByRole('radio', { name: 'Muy grande' }).click();
    await page.getByLabel('Tipografía del texto').click();
    await page.getByRole('option', { name: 'Fira Code' }).click();

    await page.goto('/es/practice');
    const word = page.locator('[data-word-index="0"]');
    await expect(word).toHaveCSS('font-size', '40px');
    await expect(word).toHaveCSS('font-family', /Fira/);
  });

  test('las preferencias guardadas inválidas no rompen la página', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'tecleo-settings',
        '{"state":{"settings":{"theme":"nope"}},"version":1}',
      );
    });
    await page.goto('/es/settings');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink');
    await expect(page.getByRole('radio', { name: 'Tinta' })).toBeChecked();
  });
});

test.describe('modo concentración', () => {
  test('mientras se escribe se esconden la navegación y las opciones', async ({ page }) => {
    await page.goto('/es/settings');
    await page.getByRole('switch', { name: 'Modo concentración' }).click();
    await page.goto('/es/practice?seed=1');
    await expect(page.getByLabel('Texto a escribir')).toBeFocused();
    const header = page.locator('header[data-chrome]');
    await expect(header).toHaveCSS('opacity', '1');
    await page.keyboard.type('x', { delay: 20 });
    await expect(header).toHaveCSS('opacity', '0');
    await page.keyboard.press('Escape');
    await expect(header).toHaveCSS('opacity', '1');
  });
});

test.describe('móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('el menú se abre y la práctica recomienda un teclado físico', async ({ page }) => {
    await page.goto('/es');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('link', { name: 'Practicar' }).click();
    await expect(page).toHaveURL('/es/practice');
    await expect(
      page.getByText('Para escribir con comodidad usa un teclado físico.'),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe('accesibilidad (axe, WCAG 2.1 AA)', () => {
  for (const path of PAGES) {
    test(`sin violaciones en ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Espera a que terminen las animaciones de entrada (el fundido baja el contraste temporalmente).
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test('los seis temas pasan contraste en la práctica', async ({ page }) => {
    for (const theme of ['ink', 'day', 'graphite', 'forest', 'plum', 'contrast']) {
      await page.addInitScript((value) => {
        localStorage.setItem(
          'tecleo-settings',
          JSON.stringify({ state: { settings: { theme: value } }, version: 1 }),
        );
      }, theme);
      await page.goto('/es/practice?seed=2');
      await page.keyboard.type('xy', { delay: 20 });
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations.map((v) => `${theme} ${v.id}: ${v.nodes.length}`)).toEqual([]);
    }
  });
});
