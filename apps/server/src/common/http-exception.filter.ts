import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { apiErrorSchema, type ApiError, type ApiErrorCode } from '@tecleo/shared';
import type { Response } from 'express';

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

/** Da a todo error HTTP (también los de Nest y del throttler) el formato `apiErrorSchema`. */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const parsed = apiErrorSchema.safeParse(exception.getResponse());
    const body: ApiError = parsed.success
      ? parsed.data
      : {
          statusCode: status,
          code: CODE_BY_STATUS[status] ?? 'VALIDATION',
          message: exception.message,
        };
    response.status(status).json(body);
  }
}
