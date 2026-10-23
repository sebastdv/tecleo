import { expect, test } from '@playwright/test';

import { field, typingTarget } from './support.js';

/**
 * La pantalla de escritura sin tirones (spec 13): mientras se escribe, ninguna tarea del hilo
 * principal llega a 50 ms (lo que el navegador llama "long task" y que se nota como salto).
 */
test('escribir no genera tareas largas en el hilo principal', async ({ page }) => {
  await page.goto('/es/practice?seed=9');
  await page.getByRole('button', { name: 'palabras', exact: true }).click();
  await page.getByRole('button', { name: '50', exact: true }).click();
  await expect(field(page, 'Texto a escribir')).toBeFocused();
  await page.evaluate(() => {
    const store = window as unknown as { longTasks: number[] };
    store.longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.longTasks.push(entry.duration);
    }).observe({ type: 'longtask' });
  });

  // ~200 ppm: más rápido que casi cualquier persona.
  const text = await typingTarget(page);
  await page.keyboard.type(text.slice(0, 200), { delay: 60 });

  const longTasks = await page.evaluate(
    () => (window as unknown as { longTasks: number[] }).longTasks,
  );
  expect(longTasks).toEqual([]);
});
