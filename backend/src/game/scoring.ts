import type { Grade, ScoreBreakdown } from '@mysterytalk/shared';

/**
 * 점수 규칙(SPEC §8, PRD §8.1). 수치는 [잠정]이라 플레이테스트 후 이 한 곳만 고친다.
 */
export const SCORE_RULES = {
  base: 100,
  questionPenaltyPerExtra: 2,
  questionPenaltyMax: 40,
  /** n번째 힌트 열람 감점(누적 10 → 25 → 45) */
  hintPenaltySteps: [10, 15, 20],
  wrongPenaltyEach: 10,
  gradeCuts: { S: 90, A: 80, B: 70 },
} as const;

/** 힌트 해금 시점: ⌈B/3⌉, ⌈2B/3⌉, B (SPEC §9.1, PRD D17) */
export function hintUnlockAt(baseQuestions: number): [number, number, number] {
  return [Math.ceil(baseQuestions / 3), Math.ceil((2 * baseQuestions) / 3), baseQuestions];
}

export type ScoreInput = {
  baseQuestions: number;
  questionsUsed: number;
  hintsViewed: number;
  wrongSubmissions: number;
};

/** 감점형 점수와 항목별 내역. 0 미만으로 내려가지 않는다. */
export function computeScore(input: ScoreInput): { score: number; breakdown: ScoreBreakdown } {
  const r = SCORE_RULES;
  const extra = Math.max(0, input.questionsUsed - input.baseQuestions);
  const questionPenalty = Math.min(r.questionPenaltyMax, extra * r.questionPenaltyPerExtra);
  const hintPenalty = r.hintPenaltySteps
    .slice(0, Math.min(input.hintsViewed, r.hintPenaltySteps.length))
    .reduce((sum, p) => sum + p, 0);
  const wrongPenalty = input.wrongSubmissions * r.wrongPenaltyEach;
  const score = Math.max(0, r.base - questionPenalty - hintPenalty - wrongPenalty);
  return {
    score,
    breakdown: {
      base: r.base,
      baseQuestions: input.baseQuestions,
      questionsUsed: input.questionsUsed,
      questionPenalty,
      questionPenaltyPerExtra: r.questionPenaltyPerExtra,
      questionPenaltyMax: r.questionPenaltyMax,
      hintsViewed: input.hintsViewed,
      hintPenalty,
      hintPenaltySteps: [...r.hintPenaltySteps],
      wrongSubmissions: input.wrongSubmissions,
      wrongPenalty,
      wrongPenaltyEach: r.wrongPenaltyEach,
      gradeCuts: { ...r.gradeCuts },
    },
  };
}

/** 해결한 사건의 등급. 해결하면 최저 C를 보장한다(PRD D14). */
export function solvedGrade(score: number): Grade {
  const c = SCORE_RULES.gradeCuts;
  if (score >= c.S) return 'S';
  if (score >= c.A) return 'A';
  if (score >= c.B) return 'B';
  return 'C';
}

const GRADE_RANK: Record<Grade, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 };

/** a가 b보다 좋은 결과인가: 등급 → 점수 순. 같으면 먼저 달성한 기록을 유지한다(PRD D18). */
export function isBetter(
  a: { grade: Grade; score: number | null },
  b: { grade: Grade; score: number | null },
): boolean {
  if (GRADE_RANK[a.grade] !== GRADE_RANK[b.grade]) return GRADE_RANK[a.grade] > GRADE_RANK[b.grade];
  return (a.score ?? -1) > (b.score ?? -1);
}
