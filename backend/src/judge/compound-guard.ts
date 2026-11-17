import type { Judge, JudgeCallMeta, JudgeInput, JudgeOutcome, JudgeResult } from './judge.types.js';

/**
 * 복합 질문 오판 보정(judge-v4+neg2+cg1): AI가 RETRY/COMPOUND라고 했는데 질문에 접속 표현이 전혀 없으면
 * 한 가지만 묻는 질문을 잘못 막은 것으로 보고, RETRY를 고를 수 없게 한 번 더 판정한다.
 * 플레이테스트에서 '편지를 보낸 사람이 불을 질렀나요?'처럼 답이 일부만 맞는 질문이 복합 질문으로 막혔다.
 * 접속 표현이 하나라도 있으면(진짜 복합일 수 있음) 그대로 RETRY로 둔다. 보수적으로 넓게 잡는다:
 * 두 가지를 한 번에 물어 정보를 더 얻는 것을 막는 쪽이 잘못 막는 것보다 안전하다(잘못 막아도 미차감).
 */
const CONJUNCTION = [
  // ~고·~며·~면서·~거나·~든지 + 띄어쓰기(했고 / 하며 / 하면서 / 했거나 / 하든지)
  /[가-힣](고|며|면서|거나|든지|든가)\s/,
  // 접속 부사·조사
  /(그리고|그러고|및|또는|혹은|아니면|그래서|그러면서)/,
  // 명사 잇기(조카와 관리인 / 조카랑 / 조카하고)
  /[가-힣](와|과|랑|이랑|하고)\s/,
  // 쉼표로 늘어놓기
  /[,，、]/,
];

export function hasConjunction(question: string): boolean {
  return CONJUNCTION.some((re) => re.test(question));
}

/** 한 가지만 묻는 질문으로 다시 판정할 수 있는 판정기(Ollama 등). 없으면 보정하지 않는다. */
export type SingleAwareJudge = Judge & {
  judgeSingle?: (input: JudgeInput) => Promise<JudgeOutcome>;
};

export async function applyCompoundGuard(
  judge: SingleAwareJudge,
  input: JudgeInput,
  first: JudgeResult,
): Promise<{ result: JudgeResult; calls: JudgeCallMeta[]; changed: boolean }> {
  if (
    !judge.judgeSingle ||
    first.label !== 'RETRY' ||
    first.retryReason !== 'COMPOUND' ||
    hasConjunction(input.question)
  ) {
    return { result: first, calls: [], changed: false };
  }
  const again = await judge.judgeSingle(input);
  // 다시 판정에 실패하면 첫 판정('다시 질문', 미차감)을 그대로 쓴다
  if (!again.ok || again.result.label === 'RETRY')
    return { result: first, calls: again.calls, changed: false };
  return { result: again.result, calls: again.calls, changed: true };
}
