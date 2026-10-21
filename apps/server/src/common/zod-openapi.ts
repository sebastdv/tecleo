import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Convierte un esquema Zod de `@tecleo/shared` en un esquema OpenAPI para Swagger,
 * así la documentación sale de la misma fuente que la validación.
 */
export function zodToOpenApi(schema: z.ZodType): SchemaObject {
  // El JSON Schema que genera Zod con target openapi-3.0 es un SchemaObject válido;
  // los tipos de ambas librerías no se solapan, de ahí la conversión explícita.
  return z.toJSONSchema(schema, { target: 'openapi-3.0' }) as SchemaObject;
}
