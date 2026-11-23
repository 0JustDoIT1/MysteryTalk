import { JUDGE_MAX_STAGES, leaseMsFor } from './session-lease.js';

// 코드 검수(2026-11-23) 재현 테스트: 질문 판정은 첫 판정·복합 재판정·부정형 재확인 3단계가
// 각각 1회 재시도까지 할 수 있어(최대 6회 호출), 선점이 판정보다 먼저 끝나면 결과가 버려졌다.
describe('처리 중 선점 시간', () => {
  it('질문은 판정 단계 3개 × (호출 + 재시도)를 모두 덮는다', () => {
    const timeout = 12_000;
    expect(JUDGE_MAX_STAGES).toBe(3);
    expect(leaseMsFor(timeout, JUDGE_MAX_STAGES)).toBeGreaterThan(timeout * 2 * 3);
  });

  it('정답 채점은 한 단계(호출 + 재시도)를 덮는다', () => {
    expect(leaseMsFor(12_000)).toBeGreaterThan(12_000 * 2);
  });
});
