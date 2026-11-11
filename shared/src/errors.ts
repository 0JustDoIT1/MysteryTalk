import { z } from 'zod';

/**
 * 서버가 돌려주는 오류 코드(SPEC §5). 서버는 code만 보내고,
 * 화면 문구는 클라이언트가 ERROR_MESSAGES로 표시한다.
 */
export const ERROR_CODES = [
  'INVALID_INPUT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_MISMATCH',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'ACTIVE_SESSION_EXISTS',
  'SESSION_FINISHED',
  'SESSION_BUSY',
  'QUESTION_CAP_REACHED',
  'HINT_LOCKED',
  'ZONE_LOCKED',
  'NAME_NOT_ALLOWED',
  'INVALID_MOVE',
  'SESSION_NOT_FINISHED',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
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
  IDEMPOTENCY_KEY_REQUIRED: '요청 식별 정보가 없어요. 다시 시도해 주세요.',
  IDEMPOTENCY_MISMATCH: '같은 요청 식별 정보로 다른 내용을 보낼 수 없어요.',
  UNAUTHORIZED: '접근 권한이 없어요.',
  NOT_FOUND: '요청한 내용을 찾을 수 없어요.',
  ACTIVE_SESSION_EXISTS:
    '이미 진행 중인 수사가 있어요. 이어서 하거나 포기한 뒤 새로 시작해 주세요.',
  SESSION_FINISHED: '이미 끝난 사건이에요.',
  SESSION_BUSY: '이전 질문을 처리하고 있어요. 잠시 후 다시 시도해 주세요.',
  QUESTION_CAP_REACHED: '이 사건에서 할 수 있는 질문을 모두 썼어요. 정답을 제출해 주세요.',
  HINT_LOCKED: '아직 열 수 없는 힌트예요. 질문을 더 하거나 앞 힌트를 먼저 열어 주세요.',
  NAME_NOT_ALLOWED: '사용할 수 없는 이름이에요. 1~12자로, 욕설 없이 지어 주세요.',
  ZONE_LOCKED: '아직 들어갈 수 없는 곳이에요.',
  INVALID_MOVE: '위치가 맞지 않아 다시 맞췄어요.',
  SESSION_NOT_FINISHED: '사건이 끝난 뒤에 볼 수 있어요.',
  RATE_LIMITED: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  AI_UNAVAILABLE: '판정이 잠시 지연되고 있어요. 질문 수는 차감되지 않았어요. 다시 시도해 주세요.',
  INTERNAL_ERROR: '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
};
