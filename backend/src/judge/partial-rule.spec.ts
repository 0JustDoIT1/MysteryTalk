import type { Fact } from '@mysterytalk/shared';
import type { JudgeResult } from './judge.types.js';
import { applyPartialRule } from './partial-rule.js';

const facts: Fact[] = [
  {
    id: 'F01',
    kind: 'PARTIAL',
    text: '열쇠가 든 자루를 옮겼으니 가져간 셈이지만, 열쇠가 있는 줄 몰랐다.',
  },
  { id: 'F02', kind: 'PARTIAL', text: '자리를 비웠지만 금방 돌아왔다.' },
  { id: 'F03', kind: 'FACT', text: '열쇠는 세탁소에 있다.' },
  { id: 'F04', kind: 'NEGATIVE', text: '도난이 아니다.' },
];
const r = (label: JudgeResult['label'], factIds: string[]): JudgeResult => ({
  label,
  retryReason: label === 'RETRY' ? 'UNCLEAR' : null,
  factIds,
});

describe('부분 사실 보정', () => {
  it.each([
    ['YES', ['F01']],
    ['NO', ['F01', 'F02']],
  ] as const)('예/아니오(%s)의 근거가 전부 부분 사실이면 그럴 수도로 바꾼다', (label, ids) => {
    expect(applyPartialRule(facts, r(label, [...ids]))).toEqual({
      result: r('MAYBE', [...ids]),
      changed: true,
    });
  });

  it('근거에 확정 사실(FACT·NEGATIVE)이 섞여 있으면 그대로 둔다', () => {
    for (const ids of [
      ['F01', 'F03'],
      ['F04', 'F02'],
    ]) {
      const result = r('YES', ids);
      expect(applyPartialRule(facts, result)).toEqual({ result, changed: false });
    }
  });

  it('근거가 없거나, 예/아니오가 아닌 판정은 건드리지 않는다', () => {
    for (const result of [
      r('YES', []),
      r('IRRELEVANT', ['F01']),
      r('MAYBE', ['F01']),
      r('RETRY', []),
    ])
      expect(applyPartialRule(facts, result)).toEqual({ result, changed: false });
  });
});
