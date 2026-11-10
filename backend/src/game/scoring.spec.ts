import { computeScore, hintUnlockAt, isBetter, solvedGrade } from './scoring.js';

const base = { baseQuestions: 20, questionsUsed: 20, hintsViewed: 0, wrongSubmissions: 0 };

describe('점수 계산 (SPEC §8)', () => {
  it('기준 질문 수 이내, 힌트·오답 없음 → 100점', () => {
    expect(computeScore(base).score).toBe(100);
  });

  it('질문 초과는 1개당 2점, 최대 40점', () => {
    expect(computeScore({ ...base, questionsUsed: 21 }).breakdown.questionPenalty).toBe(2);
    expect(computeScore({ ...base, questionsUsed: 40 }).breakdown.questionPenalty).toBe(40);
    expect(computeScore({ ...base, questionsUsed: 60 }).breakdown.questionPenalty).toBe(40);
  });

  it('힌트는 누적 10 → 25 → 45점', () => {
    expect([0, 1, 2, 3].map((h) => computeScore({ ...base, hintsViewed: h }).score)).toEqual([
      100, 90, 75, 55,
    ]);
  });

  it('오답 1회당 10점, 0점 아래로 내려가지 않는다', () => {
    expect(computeScore({ ...base, wrongSubmissions: 2 }).score).toBe(80);
    expect(
      computeScore({ ...base, questionsUsed: 60, hintsViewed: 3, wrongSubmissions: 2 }).score,
    ).toBe(0);
  });

  it('내역에 항목별 감점과 규칙 수치가 들어 있다(튜토리얼 설명용)', () => {
    const { breakdown } = computeScore({
      ...base,
      questionsUsed: 23,
      hintsViewed: 1,
      wrongSubmissions: 1,
    });
    expect(breakdown).toMatchObject({
      questionPenalty: 6,
      hintPenalty: 10,
      wrongPenalty: 10,
      questionPenaltyPerExtra: 2,
      hintPenaltySteps: [10, 15, 20],
      gradeCuts: { S: 90, A: 80, B: 70 },
    });
  });
});

describe('등급 (PRD §8.1)', () => {
  it.each([
    [100, 'S'],
    [90, 'S'],
    [89, 'A'],
    [80, 'A'],
    [79, 'B'],
    [70, 'B'],
    [69, 'C'],
    [0, 'C'],
  ])('%i점 → %s (해결 시 최저 C)', (score, grade) => {
    expect(solvedGrade(score)).toBe(grade);
  });

  it('더 좋은 결과: 등급 우선, 같으면 점수, 완전히 같으면 기존 유지', () => {
    expect(isBetter({ grade: 'A', score: 80 }, { grade: 'B', score: 79 })).toBe(true);
    expect(isBetter({ grade: 'S', score: 95 }, { grade: 'S', score: 92 })).toBe(true);
    expect(isBetter({ grade: 'S', score: 92 }, { grade: 'S', score: 92 })).toBe(false);
    expect(isBetter({ grade: 'D', score: null }, { grade: 'F', score: null })).toBe(true);
    expect(isBetter({ grade: 'F', score: null }, { grade: 'C', score: 10 })).toBe(false);
  });
});

describe('힌트 해금 시점 (SPEC §9.1)', () => {
  it.each([
    [15, [5, 10, 15]],
    [20, [7, 14, 20]],
    [30, [10, 20, 30]],
    [40, [14, 27, 40]],
  ])('B=%i → ⌈B/3⌉, ⌈2B/3⌉, B = %j', (b, expected) => {
    expect(hintUnlockAt(b)).toEqual(expected);
  });
});
