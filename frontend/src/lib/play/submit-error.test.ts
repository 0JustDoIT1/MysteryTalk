import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { submitErrorMessage } from './submit-error';

// 코드 검수(2026-11-23) 재현: 서버 오류 코드의 공통 문구가 질문 기준이라, 정답 제출이 막혀도
// '정답 제출은 계속할 수 있어요'·'질문 수는 차감되지 않았어요'라고 안내했다.
describe('정답 제출 오류 문구', () => {
  it('월 예산 소진은 제출도 막혔다고 알린다', () => {
    const msg = submitErrorMessage(new ApiError('MONTHLY_BUDGET_REACHED', 429, '공통 문구'));
    expect(msg).not.toContain('정답 제출은 계속할 수 있어요');
    expect(msg).toContain('채점');
  });

  it('채점 지연은 제출 기회가 줄지 않았다고 알린다', () => {
    const msg = submitErrorMessage(new ApiError('AI_UNAVAILABLE', 503, '공통 문구'));
    expect(msg).not.toContain('질문 수');
    expect(msg).toContain('제출 기회');
  });

  it('그 밖의 오류는 공통 문구를 그대로 쓴다', () => {
    expect(submitErrorMessage(new ApiError('SESSION_FINISHED', 409, '이미 끝난 사건이에요.'))).toBe(
      '이미 끝난 사건이에요.',
    );
    expect(submitErrorMessage(new Error('네트워크'))).toBe('네트워크');
  });
});
