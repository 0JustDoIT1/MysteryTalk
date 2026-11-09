import { z } from 'zod';

/**
 * 서버가 돌려주는 오류 코드(SPEC §5). 서버는 code만 보내고,
 * 화면 문구는 클라이언트가 ERROR_MESSAGES로 표시한다.
 * 이후 단계에서 코드를 추가할 때 이 목록과 문구를 함께 갱신한다.
 */
export const ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: '입력 형식이 올바르지 않아요.',
  UNAUTHORIZED: '접근 권한이 없어요.',
  NOT_FOUND: '요청한 내용을 찾을 수 없어요.',
  RATE_LIMITED: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  INTERNAL_ERROR: '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
};
