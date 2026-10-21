import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { ApiException } from './api-exception.js';

/** Valida y transforma la entrada con un esquema de @tecleo/shared. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
      throw new ApiException(400, 'VALIDATION', 'Datos inválidos', fields);
    }
    return result.data;
  }
}
