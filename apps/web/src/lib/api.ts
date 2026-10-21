import {
  apiErrorSchema,
  authResponseSchema,
  type ApiErrorCode,
  type AuthResponse,
} from '@tecleo/shared';
import type { z } from 'zod';

import { useAuthStore } from '@/auth/auth-store';

/** Error de la API con el código de `apiErrorSchema`, para mostrar un mensaje traducido. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK',
    message: string,
    readonly fields: readonly string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  /** Agrega el access token y, si vence, lo renueva una vez y reintenta. */
  readonly auth?: boolean;
  readonly signal?: AbortSignal;
}

async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      ...(options.signal && { signal: options.signal }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'Sin conexión con el servidor');
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
  if (parsed.success) {
    return new ApiError(response.status, parsed.data.code, parsed.data.message, parsed.data.fields);
  }
  // El proxy de Next responde 500 sin cuerpo JSON cuando el server no está levantado.
  return new ApiError(response.status, 'NETWORK', `HTTP ${response.status}`);
}

let refreshing: Promise<AuthResponse | null> | null = null;

const RETRY_DELAYS_MS = [1_000, 3_000];
const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Pide un access token nuevo con la cookie de refresh. Varias peticiones que vencen a la vez
 * comparten la misma renovación (el servidor solo acepta cada refresh token una vez).
 * Solo un 401 significa "no hay sesión"; límites, caídas o falta de red se reintentan.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      for (let attempt = 0; ; attempt++) {
        let response: Response | null = null;
        try {
          response = await send('/auth/refresh', { method: 'POST' }, null);
        } catch {
          response = null;
        }
        if (response?.ok) {
          const session = authResponseSchema.parse(await response.json());
          useAuthStore.getState().setSession(session);
          return session;
        }
        const delay = RETRY_DELAYS_MS[attempt];
        if (response?.status === 401 || delay === undefined) {
          useAuthStore.getState().clear();
          return null;
        }
        await wait(delay);
      }
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Llama a la API del server a través del proxy `/api` de Next y valida la respuesta con el
 * esquema compartido: si el server cambia el contrato, falla aquí y no en la UI.
 */
export async function fetchApi<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  const token = options.auth ? useAuthStore.getState().accessToken : null;
  let response = await send(path, options, token);
  if (response.status === 401 && options.auth) {
    const session = await refreshSession();
    if (session) response = await send(path, options, session.accessToken);
  }
  if (!response.ok) throw await toApiError(response);
  const body: unknown = response.status === 204 ? null : await response.json();
  return schema.parse(body);
}
