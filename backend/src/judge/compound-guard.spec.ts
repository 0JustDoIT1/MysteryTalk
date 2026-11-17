import type { Fact } from '@mysterytalk/shared';
import { applyCompoundGuard, hasConjunction, type SingleAwareJudge } from './compound-guard.js';
import type { JudgeInput, JudgeOutcome, JudgeResult } from './judge.types.js';

const facts: Fact[] = [{ id: 'F01', kind: 'FACT', text: '1·2번 불은 대원이 질렀다.' }];
const input = (question: string): JudgeInput => ({ intro: '소개', facts, question });
const meta = [{ model: 'fake', latencyMs: 1, tokensIn: null, tokensOut: null, ok: true }];
const compound: JudgeResult = { label: 'RETRY', retryReason: 'COMPOUND', factIds: [] };

function judgeWith(again: JudgeOutcome | null): SingleAwareJudge & { singles: number } {
  const j = {
    model: 'fake',
    singles: 0,
    judge: (): Promise<JudgeOutcome> => Promise.reject(new Error('not used')),
    ...(again
      ? {
          judgeSingle: () => {
            j.singles += 1;
            return Promise.resolve(again);
          },
        }
      : {}),
  };
  return j;
}

describe('접속 표현 판별(복합 질문 오판 보정)', () => {
  it.each([
    '편지를 보낸 사람이 불을 질렀나요?',
    '소방 관계자가 범인인가요?',
    '조카가 범인인가요?',
    '사장이 직접 뒷문 유리를 깼나요?',
    '세 번째 불 전에도 편지가 왔나요?',
  ])('한 가지만 묻는 질문: %s', (q) => {
    expect(hasConjunction(q)).toBe(false);
  });

  // 평가 세트의 복합 질문(사건 13건)은 모두 접속 표현이 있어 '다시 질문'으로 남는다
  it.each([
    '문태성이 밀쳤고 차단기도 내렸나요?',
    '열쇠는 세탁소에 있고 금고는 열렸나요?',
    '팀장이 범인이고 뒷돈 때문에 그랬나요?',
    '조카가 수면제를 타고 보일러도 풀었나요?',
    '대원이 1·2번을 질렀고 건물주가 3번을 질렀나요?',
    '조카와 관리인이 같이 했나요?',
    '조카가 했거나 관리인이 했나요?',
    '조카, 관리인 중 누가 했나요?',
    '조카가 밀치면서 차단기를 내렸나요?',
    '돈 때문이었나요, 아니면 원한 때문이었나요?',
  ])('접속 표현 있음: %s', (q) => {
    expect(hasConjunction(q)).toBe(true);
  });
});

describe('복합 질문 오판 보정', () => {
  it('접속 표현이 없는데 복합 질문이라 하면 다시 판정해 그 결과를 쓴다', async () => {
    const j = judgeWith({
      ok: true,
      result: { label: 'MAYBE', retryReason: null, factIds: ['F01'] },
      calls: meta,
    });
    const r = await applyCompoundGuard(j, input('편지를 보낸 사람이 불을 질렀나요?'), compound);
    expect(r).toMatchObject({ changed: true, result: { label: 'MAYBE', factIds: ['F01'] } });
    expect(r.calls).toHaveLength(1);
  });

  it('접속 표현이 있으면 다시 판정하지 않고 다시 질문으로 둔다(추가 호출 없음)', async () => {
    const j = judgeWith({ ok: true, result: { ...compound }, calls: meta });
    const r = await applyCompoundGuard(j, input('조카가 밀쳤고 차단기도 내렸나요?'), compound);
    expect(r).toEqual({ result: compound, calls: [], changed: false });
    expect(j.singles).toBe(0);
  });

  it('복합 질문이 아닌 판정·다른 다시 질문 사유는 건드리지 않는다', async () => {
    const j = judgeWith({ ok: true, result: { ...compound }, calls: meta });
    const yes: JudgeResult = { label: 'YES', retryReason: null, factIds: ['F01'] };
    const open: JudgeResult = { label: 'RETRY', retryReason: 'OPEN', factIds: [] };
    expect((await applyCompoundGuard(j, input('조카가 범인인가요?'), yes)).changed).toBe(false);
    expect((await applyCompoundGuard(j, input('조카가 범인인가요?'), open)).changed).toBe(false);
    expect(j.singles).toBe(0);
  });

  it('다시 판정이 실패하거나 지원하지 않는 판정기면 다시 질문(미차감)을 그대로 쓴다', async () => {
    const failed = judgeWith({ ok: false, reason: 'timeout', calls: meta });
    const r = await applyCompoundGuard(failed, input('소방 관계자가 범인인가요?'), compound);
    expect(r).toMatchObject({ changed: false, result: compound });
    expect(r.calls).toHaveLength(1);
    const plain = judgeWith(null);
    expect(
      (await applyCompoundGuard(plain, input('소방 관계자가 범인인가요?'), compound)).changed,
    ).toBe(false);
  });
});
