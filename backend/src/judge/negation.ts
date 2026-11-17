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

/** 재확인 명제에 부정어가 있는지(아니다·않았다·없다·못했다·안 ~) */
const NEGATED_CLAIM = /(아니|않|없[다었는어지]|못[했하한]|(^|\s)안\s)/;

export function isNegativeQuestion(question: string): boolean {
  return NEGATIVE_ENDING.test(question.trim());
}

export type PositiveCheck =
  | {
      ok: true;
      truth: 'TRUE' | 'FALSE' | 'UNKNOWN';
      factIds: string[];
      /** 재확인한 긍정 명제(AI가 쓴 문장). 없으면 모순 검사를 하지 않는다 */
      claim?: string;
      calls: JudgeCallMeta[];
    }
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
  const kinds = check.factIds.map((id) => input.facts.find((f) => f.id === id)?.kind);
  const negativeBasis = kinds.includes('NEGATIVE');
  if (!negativeBasis) return { result: first, calls: check.calls, changed: false };
  // 부정 사실('~하지 않았다')만으로 긍정(부정어 없는) 명제가 참일 수는 없다. 근거가 전부 부정 사실인데
  // 긍정 명제를 '참'이라 하면 재확인 자체가 모순이므로 첫 판정을 유지한다(4번 Q30 회귀, 2026-11-18).
  // '사고가 아니지 않나요?'처럼 재확인 명제가 부정문('사고가 아니다')이면 부정 사실로 참이 될 수 있어 그대로 둔다.
  if (
    check.truth === 'TRUE' &&
    check.claim !== undefined &&
    !NEGATED_CLAIM.test(check.claim) &&
    kinds.every((k) => k === 'NEGATIVE')
  )
    return { result: first, calls: check.calls, changed: false };
  return {
    result: { label, retryReason: null, factIds: check.factIds },
    calls: check.calls,
    changed: true,
  };
}
