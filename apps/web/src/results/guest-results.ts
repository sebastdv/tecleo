import { submitResultSchema, type SubmitResultInput } from '@tecleo/shared';
import { z } from 'zod';

const KEY = 'tecleo-guest-results';
const MAX = 50;

/** Resultados del invitado en este navegador, para migrarlos a la cuenta al registrarse. */
export function readGuestResults(): SubmitResultInput[] {
  try {
    const parsed = z
      .array(submitResultSchema)
      .safeParse(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function addGuestResult(result: SubmitResultInput): void {
  const results = [...readGuestResults(), result].slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(results));
  } catch {
    // Almacenamiento lleno o bloqueado: el resultado igual se mostró en pantalla.
  }
}

export function clearGuestResults(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nada que hacer.
  }
}
