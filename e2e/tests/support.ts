import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expect, type Page } from '@playwright/test';

/**
 * Campo visible por su etiqueta. Con Cache Components, Next conserva ocultas (Activity) las
 * páginas visitadas antes, y `getByLabel` también encuentra sus campos.
 */
export const field = (page: Page, label: string) =>
  page.getByLabel(label).filter({ visible: true });

/** Datos de una cuenta de prueba nueva por test (la base local o la de CI). */
export function newAccount() {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  return { nickname: `e2e_${id}`, email: `e2e_${id}@tecleo.test`, password: `clave-${id}-e2e` };
}
export type Account = ReturnType<typeof newAccount>;

export async function register(page: Page, account: Account, importGuest = true) {
  await page.goto('/es/register');
  await field(page, 'Apodo').fill(account.nickname);
  await field(page, 'Correo electrónico').fill(account.email);
  await field(page, 'Contraseña').fill(account.password);
  const guestOption = page.getByRole('checkbox');
  if (!importGuest && (await guestOption.count()) > 0) await guestOption.uncheck();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('button', { name: `Cuenta: ${account.nickname}` })).toBeVisible();
}

/** Escribe con un ritmo irregular (como una persona): el antitrampa no lo marca. */
export async function typeLikeAHuman(page: Page, text: string, slow = 0) {
  let index = 0;
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(45 + slow + ((index++ * 37) % 11) * 9);
  }
}

/** El texto a escribir de la pantalla visible (solo para lectores de pantalla). */
export async function typingTarget(page: Page): Promise<string> {
  return (await page.locator('[data-typing-target]').filter({ visible: true }).textContent()) ?? '';
}

/** Da el rol de administrador con el script del server (misma base que usa el server). */
export function grantAdmin(email: string) {
  execFileSync('pnpm', ['--filter', '@tecleo/server', 'admin:grant', email], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    stdio: 'pipe',
  });
}
