import { z } from 'zod';
import { QUESTION_LABELS, RETRY_REASONS, type Fact } from '@mysterytalk/shared';
import type { JudgeResult } from './judge.types.js';

/**
 * AI에게 강제하는 출력 형식. null 대신 'NONE'을 써서 구조화 출력 호환성을 높인다.
 * 필드 순서가 생성 순서다: '다시 질문' 여부(retryReason) → 질문의 명제(claim) → 근거 사실(factIds) → 라벨.
 * claim은 판정 과정을 돕는 용도로만 쓰고 저장·응답하지 않는다.
 */
export const JUDGE_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    retryReason: { type: 'string', enum: [...RETRY_REASONS, 'NONE'] },
    claim: { type: 'string', maxLength: 200 },
    // judge-v4: 사실 번호를 끝없이 나열하지 않게 개수를 강제한다(출력 한도 초과로 형식 위반이 나던 문제)
    factIds: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    label: { type: 'string', enum: [...QUESTION_LABELS] },
  },
  required: ['retryReason', 'claim', 'factIds', 'label'],
  additionalProperties: false,
} as const;

/**
 * 복합 질문 오판 보정용(compound-guard): '다시 질문'을 고를 수 없는 형식. 라벨은 예·아니오·그럴 수도·관계없음만.
 */
export const JUDGE_SINGLE_OUTPUT_JSON_SCHEMA = {
  ...JUDGE_OUTPUT_JSON_SCHEMA,
  properties: {
    ...JUDGE_OUTPUT_JSON_SCHEMA.properties,
    retryReason: { type: 'string', enum: ['NONE'] },
    label: { type: 'string', enum: QUESTION_LABELS.filter((l) => l !== 'RETRY') },
  },
} as const;

const rawOutputSchema = z
  .object({
    claim: z.string().max(200).optional(),
    label: z.enum(QUESTION_LABELS),
    retryReason: z.enum([...RETRY_REASONS, 'NONE']),
    factIds: z.array(z.string()),
  })
  .strict();

/**
 * AI 출력 문자열을 검증한다(SPEC §6-9). 형식이 틀리거나, 허용 값 밖이거나,
 * RETRY인데 사유가 없거나, 존재하지 않는 사실 id를 들거나, 사실 id가 20개를 넘으면 null(형식 위반).
 * RETRY가 아닌 판정의 사유는 무시하고, RETRY 판정의 사실 id는 검사하지 않고 버린다(judge-v4).
 */
export function parseJudgeOutput(text: string, facts: Fact[]): JudgeResult | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = rawOutputSchema.safeParse(json);
  if (!parsed.success) return null;
  const { label, retryReason, factIds } = parsed.data;
  if (label === 'RETRY' && retryReason === 'NONE') return null;
  if (label === 'RETRY')
    return { label, retryReason: retryReason as JudgeResult['retryReason'], factIds: [] };
  if (factIds.length > 20) return null;
  const ids: string[] = [];
  for (const id of factIds) {
    const canonical = canonicalFactId(id, facts);
    if (canonical === null) return null;
    ids.push(canonical);
  }
  return {
    label,
    retryReason: null,
    factIds: [...new Set(ids)],
  };
}

/**
 * AI가 쓴 사실 id를 사건의 실제 id로 맞춘다. 정확히 같으면 그대로,
 * 0 채움만 다르면(F9 → F09) 숫자가 같은 사실이 정확히 하나일 때만 인정한다. 그 밖에는 null(형식 위반).
 */
export function canonicalFactId(id: string, facts: Fact[]): string | null {
  if (facts.some((f) => f.id === id)) return id;
  const m = /^F0*(\d+)$/.exec(id.trim());
  if (!m) return null;
  const matches = facts.filter((f) => Number(f.id.slice(1)) === Number(m[1]));
  return matches.length === 1 ? matches[0]!.id : null;
}
