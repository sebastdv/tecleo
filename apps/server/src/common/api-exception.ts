import { HttpException } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@tecleo/shared';

/** Error con el formato de `apiErrorSchema`: la web lo identifica por `code` y lo traduce. */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode, message: string, fields?: string[]) {
    const body: ApiError = { statusCode: status, code, message, ...(fields && { fields }) };
    super(body, status);
  }
}
