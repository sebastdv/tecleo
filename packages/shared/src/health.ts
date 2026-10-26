import { z } from 'zod';

/** Respuesta de `GET /health`; el cliente la usa para saber si el servidor ya despertó. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  /** Hora del servidor en milisegundos desde epoch. */
  serverTime: z.number().int(),
  /**
   * De dónde sacó el server la IP de quien pide (rate limiting): `proxy` si la reenvió el proxy
   * de la web con el secreto correcto, `connection` si es la de la conexión. Sirve para
   * comprobar el despliegue sin exponer ninguna IP.
   */
  clientIpSource: z.enum(['proxy', 'connection']).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
