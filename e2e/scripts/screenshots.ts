/**
 * Capturas del README (docs/images). Necesita la web y el server en marcha.
 *
 *   pnpm --filter @tecleo/e2e screenshots [url-base]
 */
import { fileURLToPath } from 'node:url';

import { chromium, type Page } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3100';
const out = (name: string) =>
  fileURLToPath(new URL(`../../docs/images/${name}.png`, import.meta.url));

async function typeSome(page: Page, chars: number, delay = 70) {
  const text = (await page.locator('[data-typing-target]').first().textContent()) ?? '';
  for (const ch of text.slice(0, chars)) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(delay + ((ch.charCodeAt(0) * 13) % 40));
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});
const page = await context.newPage();

await page.goto(`${base}/es`);
await page.waitForTimeout(800);
await page.screenshot({ path: out('inicio') });

await page.goto(`${base}/es/practice?seed=3`);
await page.waitForTimeout(500);
await typeSome(page, 70);
await page.screenshot({ path: out('practica') });

await page.goto(`${base}/es/race?seed=11`);
await page.getByRole('status').filter({ hasText: '¡Ya!' }).waitFor();
await typeSome(page, 45, 90);
await page.screenshot({ path: out('carrera') });

await page.goto(`${base}/es/practice?seed=4`);
await page.getByRole('button', { name: 'palabras', exact: true }).click();
await page.getByRole('button', { name: '25', exact: true }).click();
await typeSome(page, 10_000, 55);
await page.getByRole('region', { name: 'Resultados' }).waitFor();
await page.waitForTimeout(1_000);
await page.screenshot({ path: out('resultados') });

await page.goto(`${base}/es/room`);
await page.getByRole('button', { name: 'Crear sala' }).click();
await page.getByRole('heading', { name: /^Jugadores/ }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: out('sala') });

await page.goto(`${base}/es/leaderboards`);
await page.waitForTimeout(1_500);
await page.screenshot({ path: out('rankings') });

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});
const mobile = await phone.newPage();
await mobile.goto(`${base}/es`);
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: out('movil') });

await browser.close();
console.log('Capturas guardadas en docs/images/');
