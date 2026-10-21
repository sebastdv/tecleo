import { z } from 'zod';

/** Respuesta de `GET /health`; el cliente la usa para saber si el servidor ya despertó. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  /** Hora del servidor en milisegundos desde epoch. */
  serverTime: z.number().int(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
