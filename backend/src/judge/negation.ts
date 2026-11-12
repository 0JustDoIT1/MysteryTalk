import type { Judge, JudgeCallMeta, JudgeInput, JudgeResult } from './judge.types.js';

/**
 * 부정형 질문 재확인(판정 안정성 작업): '~아닌가요?', '~않았나요?', '~없나요?'처럼 부정형 질문은
 * 예/아니오가 뒤집히는 오답이 잦다. 첫 판정이 예/아니오일 때만, 질문을 긍정형으로 바꾼 명제의 참·거짓을
 * 한 번 더 판정해 교차 확인한다. 긍정 명제가 참이면 부정형 질문의 답은 '아니오', 거짓이면 '예'.
 * 두 답이 어긋나면 긍정형 판정을 따르되, 재확인의 근거에 부정 사실(NEGATIVE: '~없다/아니다/않았다')이 있을 때만 바꾼다.
 * 이중 부정 혼동은 부정 사실과 부정형 질문이 만날 때 생기고, 일반 사실 근거로 뒤집으면 오히려 틀리는 경우가 있었다.
 * 판정할 수 없으면(UNKNOWN·실패) 첫 판정을 그대로 쓴다.
 */
const NEGATIVE_ENDING =
  /(아닌가요|아니었나요|아닌가|아니에요|아닌지|아닌거죠|않았나요|않나요|않았어요|않은가요|않습니까|않았습니까|없었나요|없나요|없습니까|없었습니까|없어요|못했나요|못하나요|못했어요)\s*[?？]*\s*$/;

export function isNegativeQuestion(question: string): boolean {
  return NEGATIVE_ENDING.test(question.trim());
}

export type PositiveCheck =
  | { ok: true; truth: 'TRUE' | 'FALSE' | 'UNKNOWN'; factIds: string[]; calls: JudgeCallMeta[] }
  | { ok: false; calls: JudgeCallMeta[] };

/** 부정형 재확인을 지원하는 판정기(Ollama 등). 지원하지 않으면 재확인을 건너뛴다. */
export type NegationAwareJudge = Judge & {
  verifyPositive?: (input: JudgeInput) => Promise<PositiveCheck>;
};

export async function applyNegationCheck(
  judge: NegationAwareJudge,
  input: JudgeInput,
  first: JudgeResult,
): Promise<{ result: JudgeResult; calls: JudgeCallMeta[]; changed: boolean }> {
  if (
    !judge.verifyPositive ||
    (first.label !== 'YES' && first.label !== 'NO') ||
    !isNegativeQuestion(input.question)
  ) {
    return { result: first, calls: [], changed: false };
  }
  const check = await judge.verifyPositive(input);
  if (!check.ok || check.truth === 'UNKNOWN')
    return { result: first, calls: check.calls, changed: false };
  const label = check.truth === 'TRUE' ? 'NO' : 'YES';
  if (label === first.label) return { result: first, calls: check.calls, changed: false };
  const negativeBasis = check.factIds.some(
    (id) => input.facts.find((f) => f.id === id)?.kind === 'NEGATIVE',
  );
  if (!negativeBasis) return { result: first, calls: check.calls, changed: false };
  return {
    result: { label, retryReason: null, factIds: check.factIds },
    calls: check.calls,
    changed: true,
  };
}
