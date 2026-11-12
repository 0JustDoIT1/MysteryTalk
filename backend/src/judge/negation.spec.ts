import type { Fact } from '@mysterytalk/shared';
import type { JudgeInput, JudgeOutcome, JudgeResult } from './judge.types.js';
import {
  applyNegationCheck,
  isNegativeQuestion,
  type NegationAwareJudge,
  type PositiveCheck,
} from './negation.js';
import { parsePositiveCheck } from './positive-check.js';

const facts: Fact[] = [
  { id: 'F01', kind: 'NEGATIVE', text: '혼자 넘어진 사고가 아니다.' },
  { id: 'F02', kind: 'FACT', text: '열쇠는 세탁소에 있다.' },
];

function judgeWith(check: PositiveCheck | null): NegationAwareJudge & { checks: number } {
  const j = {
    model: 'fake',
    checks: 0,
    judge: (): Promise<JudgeOutcome> => Promise.reject(new Error('not used')),
    ...(check
      ? {
          verifyPositive: () => {
            j.checks += 1;
            return Promise.resolve(check);
          },
        }
      : {}),
  };
  return j;
}
const input = (question: string): JudgeInput => ({ intro: '소개', facts, question });
const yes: JudgeResult = { label: 'YES', retryReason: null, factIds: ['F01'] };
const no: JudgeResult = { label: 'NO', retryReason: null, factIds: ['F01'] };
const meta = [{ model: 'fake', latencyMs: 1, tokensIn: null, tokensOut: null, ok: true }];

describe('부정형 질문 판별', () => {
  it.each([
    '혼자 넘어진 게 아닌가요?',
    '열쇠는 도난당하지 않았나요?',
    '정전은 없었나요?',
    '문을 잠그지 못했나요',
    '범인이 아닌가요？',
  ])('부정형: %s', (q) => {
    expect(isNegativeQuestion(q)).toBe(true);
  });

  it.each([
    '혼자 넘어졌나요?',
    '정전이 있었나요?',
    '아니라고 말한 사람이 범인인가요?',
    '없어진 물건은 열쇠인가요?',
  ])('부정형 아님: %s', (q) => {
    expect(isNegativeQuestion(q)).toBe(false);
  });
});

describe('부정형 재확인 (판정 안정성)', () => {
  it('긍정 명제가 거짓이면 부정형 질문의 답은 예: 첫 판정이 아니오였다면 예로 바꾼다', async () => {
    const j = judgeWith({ ok: true, truth: 'FALSE', factIds: ['F01'], calls: meta });
    const r = await applyNegationCheck(j, input('혼자 넘어진 게 아닌가요?'), no);
    expect(r).toMatchObject({ changed: true, result: { label: 'YES', factIds: ['F01'] } });
    expect(r.calls).toHaveLength(1);
  });

  it('긍정 명제가 참이면 답은 아니오: 부정 사실이 근거면 예를 아니오로 바꾼다', async () => {
    const j = judgeWith({ ok: true, truth: 'TRUE', factIds: ['F01'], calls: meta });
    const r = await applyNegationCheck(j, input('사고가 아니지 않나요?'), yes);
    expect(r).toMatchObject({ changed: true, result: { label: 'NO' } });
  });

  it('재확인 근거가 일반 사실(FACT)뿐이면 어긋나도 첫 판정을 유지한다', async () => {
    const j = judgeWith({ ok: true, truth: 'TRUE', factIds: ['F02'], calls: meta });
    const r = await applyNegationCheck(j, input('열쇠는 세탁소에 없나요?'), yes);
    expect(r).toMatchObject({ changed: false, result: yes });
    expect(r.calls).toHaveLength(1);
  });

  it('두 판정이 같거나, 재확인이 판단 불가·실패면 첫 판정을 유지한다', async () => {
    const same = await applyNegationCheck(
      judgeWith({ ok: true, truth: 'FALSE', factIds: [], calls: meta }),
      input('혼자 넘어진 게 아닌가요?'),
      yes,
    );
    expect(same).toMatchObject({ changed: false, result: yes });
    const unknown = await applyNegationCheck(
      judgeWith({ ok: true, truth: 'UNKNOWN', factIds: [], calls: meta }),
      input('혼자 넘어진 게 아닌가요?'),
      no,
    );
    expect(unknown.result).toBe(no);
    const failed = await applyNegationCheck(
      judgeWith({ ok: false, calls: meta }),
      input('혼자 넘어진 게 아닌가요?'),
      no,
    );
    expect(failed).toMatchObject({ changed: false, result: no, calls: meta });
  });

  it('부정형이 아니거나 예/아니오가 아니면 재확인하지 않는다(추가 호출 없음)', async () => {
    const j = judgeWith({ ok: true, truth: 'TRUE', factIds: [], calls: meta });
    await applyNegationCheck(j, input('혼자 넘어졌나요?'), yes);
    await applyNegationCheck(j, input('혼자 넘어진 게 아닌가요?'), {
      label: 'MAYBE',
      retryReason: null,
      factIds: [],
    });
    expect(j.checks).toBe(0);
    const plain = await applyNegationCheck(judgeWith(null), input('혼자 넘어진 게 아닌가요?'), no);
    expect(plain.changed).toBe(false);
  });
});

describe('재확인 출력 검증', () => {
  it('허용 값과 존재하는 사실 id만 받아들인다', () => {
    expect(
      parsePositiveCheck(
        '{"positiveClaim":"혼자 넘어졌다","factIds":["F1"],"truth":"FALSE"}',
        facts,
      ),
    ).toEqual({ truth: 'FALSE', factIds: ['F01'] });
    expect(
      parsePositiveCheck('{"positiveClaim":"x","factIds":[],"truth":"MAYBE"}', facts),
    ).toBeNull();
    expect(
      parsePositiveCheck('{"positiveClaim":"x","factIds":["F99"],"truth":"TRUE"}', facts),
    ).toBeNull();
    expect(parsePositiveCheck('참입니다', facts)).toBeNull();
  });
});
