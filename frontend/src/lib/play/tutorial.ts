import type { SessionState } from '@mysterytalk/shared';

/**
 * 튜토리얼 안내 단계(PRD D78): 서버 진행 상태에서 계산한다(따로 저장하지 않음).
 * 0 질문하기 → 1 판정 읽기 → 2 힌트 열기 → 3 정답 제출. 현장 조사·단서 단계는 4단계에서 추가한다.
 */
export function tutorialStep(session: SessionState, asked: boolean): number {
  if (!asked && session.questionsUsed === 0) return 0;
  const anyUnlocked = session.hints.some((h) => h.unlocked);
  if (!anyUnlocked) return 1;
  if (!session.hints.some((h) => h.viewed)) return 2;
  return 3;
}
