import type { Fact } from '@mysterytalk/shared';
import type { JudgeResult } from './judge.types.js';

/**
 * 부분 사실 보정(judge-v4+neg2+cg1+pt1): 예/아니오 판정의 근거가 **전부** 부분 사실(PARTIAL)이면 '그럴 수도'로 바꾼다.
 * 부분 사실은 '일부만 맞거나 조건에 따라 달라지는' 사실이라(D2), 그것만으로 예/아니오가 확정되지 않는다.
 * AI는 부분 사실 질문에 MAYBE 대신 예/아니오를 자주 낸다(프롬프트 문구로는 효과가 없었다, 2026-11-16).
 * 근거에 확정 사실(FACT·NEGATIVE)이 함께 있으면 그대로 둔다: 맞는 예/아니오 판정도 부분 사실을 곁들여
 * 근거로 드는 경우가 많았다(2026-11-18 분석: 13건 중 18문항). AI를 다시 부르지 않는다.
 */
export function applyPartialRule(
  facts: Fact[],
  result: JudgeResult,
): { result: JudgeResult; changed: boolean } {
  if ((result.label !== 'YES' && result.label !== 'NO') || result.factIds.length === 0)
    return { result, changed: false };
  const allPartial = result.factIds.every(
    (id) => facts.find((f) => f.id === id)?.kind === 'PARTIAL',
  );
  if (!allPartial) return { result, changed: false };
  return { result: { ...result, label: 'MAYBE' }, changed: true };
}
