import type { SessionState } from '@mysterytalk/shared';

/**
 * 튜토리얼 안내 단계(PRD D78): 서버 진행 상태에서 계산한다(따로 저장하지 않음).
 * 0 질문하기 → 1 판정 읽기 → 2 현장 조사·단서 → 3 힌트 열기 → 4 정답 제출
 */
export function tutorialStep(session: SessionState, asked: boolean, cluesFound: number): number {
  if (!asked && session.questionsUsed === 0) return 0;
  if (cluesFound === 0) return session.questionsUsed >= 2 ? 2 : 1;
  if (!session.hints.some((h) => h.unlocked)) return 2;
  if (!session.hints.some((h) => h.viewed)) return 3;
  return 4;
}
