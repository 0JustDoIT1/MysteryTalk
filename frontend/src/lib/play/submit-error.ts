import { ApiError } from '@/lib/api/client';
import { t } from '@/i18n/ko';

/**
 * 정답 제출 창의 오류 문구. 서버 오류 코드의 공통 문구(ERROR_MESSAGES)는 질문 기준이라
 * 제출에서 다르게 읽혀야 하는 코드만 바꾼다(코드 검수 2026-11-23).
 */
export function submitErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.code === 'MONTHLY_BUDGET_REACHED') return t.submit.budgetReached;
    if (error.code === 'AI_UNAVAILABLE') return t.submit.aiUnavailable;
  }
  return error.message;
}
