import type { SubmissionResult } from '@mysterytalk/shared';

export type AiVerdict = 'MATCH' | 'NO_MATCH' | 'UNCLEAR';
/** 요소별 합의 결과(SPEC §7-5, PRD D20) */
export type Agreement = 'MATCH' | 'MISS' | 'UNCLEAR';

export type ElementForGrading = { id: string; required: boolean; keywordGroups: string[][] };

export type ElementJudgement = {
  id: string;
  required: boolean;
  keyword: boolean;
  ai: AiVerdict;
  agreement: Agreement;
};

/** 키워드 비교용 정규화: NFC, 소문자, 공백·문장부호·기호 제거 */
export function keywordKey(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

/** 키워드 그룹 판정: 그룹 안은 OR, 그룹 사이는 AND, 정규화 후 부분 문자열 일치(SPEC §7-4) */
export function keywordMatch(answer: string, groups: string[][]): boolean {
  const text = keywordKey(answer);
  return groups.every((group) => group.some((k) => text.includes(keywordKey(k))));
}

/** 둘 다 일치 → 일치, AI 불일치 + 키워드 없음 → 불일치, 그 외 → 미확정 */
export function agree(keyword: boolean, ai: AiVerdict): Agreement {
  if (keyword && ai === 'MATCH') return 'MATCH';
  if (!keyword && ai === 'NO_MATCH') return 'MISS';
  return 'UNCLEAR';
}

export type Decision = {
  result: SubmissionResult;
  elements: ElementJudgement[];
  /** 확정 일치한 필수 요소 수 / 필수 요소 수(오답 안내용, D21·D84) */
  matchedCount: number;
  totalCount: number;
};

/**
 * 제출 결과 결정(SPEC §7-6). 해결 여부는 필수 요소로만 정한다.
 * - 필수 요소가 모두 확정 일치 → SOLVED
 * - 필수 요소에 확정 불일치가 있으면 → WRONG
 * - 그 외(필수 요소에 미확정만 남음) → NEEDS_DETAIL. 단 재작성 요청을 다 썼으면(finalize)
 *   미확정을 AI 판정으로 확정한다(D23). AI도 UNCLEAR면 일치로 보지 않는다.
 */
export function decide(
  elements: ElementForGrading[],
  answer: string,
  ai: Record<string, AiVerdict>,
  finalize: boolean,
): Decision {
  const judged: ElementJudgement[] = elements.map((e) => {
    const keyword = keywordMatch(answer, e.keywordGroups);
    const verdict = ai[e.id] ?? 'UNCLEAR';
    let agreement = agree(keyword, verdict);
    if (finalize && agreement === 'UNCLEAR') agreement = verdict === 'MATCH' ? 'MATCH' : 'MISS';
    return { id: e.id, required: e.required, keyword, ai: verdict, agreement };
  });
  const required = judged.filter((e) => e.required);
  const matchedCount = required.filter((e) => e.agreement === 'MATCH').length;
  const totalCount = required.length;
  let result: SubmissionResult;
  if (matchedCount === totalCount) result = 'SOLVED';
  else if (required.some((e) => e.agreement === 'MISS')) result = 'WRONG';
  else result = 'NEEDS_DETAIL';
  return { result, elements: judged, matchedCount, totalCount };
}

/** 3번째 오답으로 끝날 때: 마지막 제출이 필수 요소 절반 이상 충족이면 PARTIAL(D), 미만이면 FAILED(F) (D69) */
export function failedStatus(matchedCount: number, totalCount: number): 'PARTIAL' | 'FAILED' {
  return matchedCount * 2 >= totalCount ? 'PARTIAL' : 'FAILED';
}
