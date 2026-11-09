import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ERROR_MESSAGES,
  errorResponseSchema,
  type ErrorCode,
  type ErrorResponse,
} from '@mysterytalk/shared';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'INVALID_INPUT',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'INVALID_INPUT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'INVALID_INPUT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * 모든 오류 응답을 `{ code, message }`로 통일한다(SPEC §5).
 * 예상하지 못한 오류는 500 INTERNAL_ERROR로 숨기고 서버 로그에만 남긴다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): {
    status: number;
    body: ErrorResponse;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const parsed = errorResponseSchema.safeParse(exception.getResponse());
      if (parsed.success) return { status, body: parsed.data };
      const code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_INPUT');
      return { status, body: { code, message: ERROR_MESSAGES[code] } };
    }
    this.logger.error(
      `Unhandled error: ${exception instanceof Error ? exception.stack : String(exception)}`,
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR },
    };
  }
}
