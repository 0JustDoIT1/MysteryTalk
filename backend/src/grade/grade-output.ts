import { z } from 'zod';
import type { AiVerdict } from './decide.js';

const VERDICTS = ['MATCH', 'NO_MATCH', 'UNCLEAR'] as const;
/** 마지막 판정(재작성 요청을 다 쓴 뒤)에서는 '애매함' 없이 둘 중 하나를 고르게 한다(D23). */
const FINAL_VERDICTS = ['MATCH', 'NO_MATCH'] as const;
/** 답안 형식. 문장으로 경위를 주장한 답안만 요소별 판정을 그대로 쓴다. */
export const ANSWER_FORMS = ['STATEMENT', 'KEYWORD_LIST', 'HEDGE'] as const;
export type AnswerForm = (typeof ANSWER_FORMS)[number];

export type GradeOutput = { form: AnswerForm; verdicts: Record<string, AiVerdict> };

/**
 * 요소 id마다 정확히 한 번씩 판정하도록 사건별 JSON 스키마를 만든다(SPEC §7-3).
 * 생성 순서: 답안 형식(form) → 요소별 evidence(답안 속 해당 구절) → verdict. evidence는 저장·응답하지 않는다.
 */
export function gradeOutputJsonSchema(elementIds: string[], final = false): object {
  const item = {
    type: 'object',
    properties: {
      evidence: { type: 'string', maxLength: 150 },
      verdict: { type: 'string', enum: [...(final ? FINAL_VERDICTS : VERDICTS)] },
    },
    required: ['evidence', 'verdict'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: {
      form: { type: 'string', enum: [...ANSWER_FORMS] },
      ...Object.fromEntries(elementIds.map((id) => [id, item])),
    },
    required: ['form', ...elementIds],
    additionalProperties: false,
  };
}

/**
 * AI 출력 검증: 모든 요소가 정확히 한 번, 허용 값만. 아니면 null(형식 위반).
 * 마지막 판정에서 UNCLEAR가 오면 형식 위반이다.
 * 단어 나열·여러 가능성 나열(form ≠ STATEMENT)은 무엇을 주장하는지 확정할 수 없으므로
 * 평소에는 모든 요소를 UNCLEAR(재작성 요청)로, 마지막 판정에서는 NO_MATCH로 돌린다(키워드 나열로 해결되는 것 방지, D20).
 */
export function parseGradeOutput(
  text: string,
  elementIds: string[],
  final = false,
): GradeOutput | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const item = z
    .object({
      evidence: z.string().max(150).optional(),
      verdict: z.enum(final ? FINAL_VERDICTS : VERDICTS),
    })
    .strict();
  const schema = z
    .object({
      form: z.enum(ANSWER_FORMS),
      ...Object.fromEntries(elementIds.map((id) => [id, item])),
    })
    .strict();
  const parsed = schema.safeParse(json);
  if (!parsed.success) return null;
  const data = parsed.data as unknown as Record<string, { verdict: AiVerdict }> & {
    form: AnswerForm;
  };
  const fallback: AiVerdict = final ? 'NO_MATCH' : 'UNCLEAR';
  return {
    form: data.form,
    verdicts: Object.fromEntries(
      elementIds.map((id) => [id, data.form === 'STATEMENT' ? data[id]!.verdict : fallback]),
    ),
  };
}
