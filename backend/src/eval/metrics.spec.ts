import type { EvalQuestion } from './eval-set.js';
import { majorityLabel, percentile, reportQuestion, summarize, type EvalRun } from './metrics.js';

const run = (label: EvalRun['label'], extra: Partial<EvalRun> = {}): EvalRun => ({
  label,
  retryReason: null,
  latencyMs: 100,
  calls: 1,
  invalidCalls: 0,
  tokensIn: 500,
  tokensOut: 20,
  ...extra,
});
const q = (o: Partial<EvalQuestion>): EvalQuestion => ({
  id: 'Q',
  category: 'direct',
  q: '질문',
  expected: 'YES',
  ...o,
});

describe('eval metrics', () => {
  it('다수결 라벨과 백분위', () => {
    expect(majorityLabel([run('YES'), run('NO'), run('YES')])).toBe('YES');
    expect(percentile([10, 20, 30, 40, 100], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 100], 95)).toBe(100);
  });

  it('accept 목록과 RETRY 사유를 반영해 채점한다', () => {
    expect(
      reportQuestion(q({ expected: 'NO', accept: ['NO', 'RETRY'] }), [run('RETRY')]).correct,
    ).toBe(true);
    const r = reportQuestion(q({ expected: 'RETRY', expectedReason: 'OPEN' }), [
      run('RETRY', { retryReason: 'OPEN' }),
      run('RETRY', { retryReason: 'COMPOUND' }),
      run('RETRY', { retryReason: 'OPEN' }),
    ]);
    expect(r).toMatchObject({ correct: true, reasonCorrect: true, flipped: false });
  });

  it('요약: 변동, 동의어 모순, 인젝션 성공, 형식 위반, 실패율', () => {
    const reports = [
      reportQuestion(q({ id: 'A', pairId: 'p', expected: 'YES' }), [
        run('YES'),
        run('NO'),
        run('YES'),
      ]),
      reportQuestion(q({ id: 'B', pairId: 'p', expected: 'YES' }), [
        run('NO'),
        run('NO'),
        run('NO'),
      ]),
      reportQuestion(q({ id: 'C', category: 'injection', expected: 'RETRY' }), [
        run('YES', { calls: 2, invalidCalls: 1 }),
        run('RETRY'),
        run(null, { calls: 2, invalidCalls: 2 }),
      ]),
    ];
    const s = summarize(reports);
    expect(s.majorityAccuracy).toBeCloseTo(1 / 3);
    expect(s.flipRate).toBeCloseTo(2 / 3);
    expect(s.pairContradictions).toEqual(['p']);
    expect(s.injectionSuccessRate).toBeCloseTo(2 / 3);
    expect(s.invalidOutputRate).toBeCloseTo(3 / 11);
    expect(s.failureRate).toBeCloseTo(1 / 9);
  });
});
