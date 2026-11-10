import type { Fact } from '@mysterytalk/shared';
import { JUDGE_OUTPUT_JSON_SCHEMA, parseJudgeOutput } from './judge-output.js';

const facts: Fact[] = [
  { id: 'F01', kind: 'NEGATIVE', text: '도난당하지 않았다.' },
  { id: 'F02', kind: 'FACT', text: '열쇠는 세탁소에 있다.' },
];
const out = (o: unknown) => JSON.stringify(o);

describe('parseJudgeOutput (SPEC §6-9)', () => {
  it('정상 출력을 받아들이고 사실 id 중복을 없앤다', () => {
    expect(
      parseJudgeOutput(out({ label: 'YES', retryReason: 'NONE', factIds: ['F02', 'F02'] }), facts),
    ).toEqual({ label: 'YES', retryReason: null, factIds: ['F02'] });
  });

  it('0 채움만 다른 사실 id(F2)는 실제 id(F02)로 맞춘다', () => {
    expect(
      parseJudgeOutput(out({ label: 'YES', retryReason: 'NONE', factIds: ['F2', 'F02'] }), facts),
    ).toEqual({ label: 'YES', retryReason: null, factIds: ['F02'] });
  });

  it('판정 과정용 claim은 받아들이되 결과에 넣지 않는다', () => {
    expect(
      parseJudgeOutput(
        out({ retryReason: 'NONE', claim: '도난당했다', factIds: ['F01'], label: 'NO' }),
        facts,
      ),
    ).toEqual({ label: 'NO', retryReason: null, factIds: ['F01'] });
  });

  it('AI에게 사유 → 명제 → 근거 → 라벨 순서로 생성시킨다', () => {
    expect(JUDGE_OUTPUT_JSON_SCHEMA.required).toEqual(['retryReason', 'claim', 'factIds', 'label']);
    expect(Object.keys(JUDGE_OUTPUT_JSON_SCHEMA.properties)).toEqual([
      ...JUDGE_OUTPUT_JSON_SCHEMA.required,
    ]);
  });

  it('RETRY는 사유를 함께 돌려준다', () => {
    expect(
      parseJudgeOutput(out({ label: 'RETRY', retryReason: 'COMPOUND', factIds: [] }), facts),
    ).toEqual({ label: 'RETRY', retryReason: 'COMPOUND', factIds: [] });
  });

  it('RETRY가 아니면 사유는 무시한다', () => {
    expect(
      parseJudgeOutput(out({ label: 'NO', retryReason: 'OPEN', factIds: ['F01'] }), facts)
        ?.retryReason,
    ).toBeNull();
  });

  it.each([
    ['JSON이 아님', '예, 맞습니다'],
    ['허용되지 않은 라벨', out({ label: 'PROBABLY', retryReason: 'NONE', factIds: [] })],
    ['RETRY인데 사유 없음', out({ label: 'RETRY', retryReason: 'NONE', factIds: [] })],
    ['없는 사실 id', out({ label: 'YES', retryReason: 'NONE', factIds: ['F99'] })],
    [
      '추가 필드(자유 서술)',
      out({ label: 'YES', retryReason: 'NONE', factIds: [], explanation: '정답은...' }),
    ],
    ['필드 누락', out({ label: 'YES' })],
    [
      '너무 긴 claim',
      out({ retryReason: 'NONE', claim: 'ㄱ'.repeat(201), factIds: [], label: 'YES' }),
    ],
  ])('형식 위반: %s', (_name, text) => {
    expect(parseJudgeOutput(text, facts)).toBeNull();
  });
});
