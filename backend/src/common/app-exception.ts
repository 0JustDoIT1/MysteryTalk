import { HttpException } from '@nestjs/common';
import { ERROR_MESSAGES, type ErrorCode, type ErrorResponse } from '@mysterytalk/shared';

/** 응답 본문을 항상 `{ code, message }` 형식으로 만드는 예외(SPEC §5). */
export class AppException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message: string = ERROR_MESSAGES[code],
  ) {
    const body: ErrorResponse = { code, message };
    super(body, status);
  }
}
