import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Llama a la API del server a través del proxy `/api` de Next y valida la respuesta
 * con el esquema compartido; si el server cambia el contrato, falla aquí y no en la UI.
 */
export async function fetchApi<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    throw new ApiError(response.status, `${init?.method ?? 'GET'} ${path} → ${response.status}`);
  }
  return schema.parse(await response.json());
}
