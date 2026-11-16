import { z } from 'zod';
import type { AiVerdict } from './decide.js';

const VERDICTS = ['MATCH', 'NO_MATCH', 'UNCLEAR'] as const;
/** 마지막 판정(재작성 요청을 다 쓴 뒤)에서는 '애매함' 없이 둘 중 하나를 고르게 한다(D23). */
const FINAL_VERDICTS = ['MATCH', 'NO_MATCH'] as const;
/** 답안 형식. 문장으로 경위를 주장한 답안만 요소별 판정을 그대로 쓴다. */
export const ANSWER_FORMS = ['STATEMENT', 'KEYWORD_LIST', 'HEDGE'] as const;
export type AnswerForm = (typeof ANSWER_FORMS)[number];

export type GradeOutput = { form: AnswerForm; verdicts: Record<string, AiVerdict> };

/** 채점 방식을 지시하는 말. 이런 구절은 어떤 요소의 근거도 될 수 없다. */
const GRADING_INSTRUCTION =
  /MATCH|SOLVED|만점|정답\s*(으로|처리)|충족한\s*것으로|채점|판정하라|처리해\s*주|처리할\s*것|처리하라/i;

/**
 * 요소 id마다 정확히 한 번씩 판정하도록 사건별 JSON 스키마를 만든다(SPEC §7-3).
 * 생성 순서: 답안 형식(form) → 요소별 evidence(답안 속 해당 구절, 최대 40자: 출력을 짧게 해 지연을 줄임, grade-v5) → verdict. evidence는 저장·응답하지 않는다.
 */
export function gradeOutputJsonSchema(elementIds: string[], final = false): object {
  const item = {
    type: 'object',
    properties: {
      evidence: { type: 'string', maxLength: 40 },
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
 * 문장 답안의 근거 구절 검사(grade-v5):
 * - UNCLEAR인데 evidence가 비어 있으면(답안에 관련된 말이 없음) NO_MATCH. 빠진 요소를 '애매함'으로 보면
 *   오답이어야 할 답안이 감점 없는 재작성 요청이 된다.
 * - MATCH인데 evidence가 비었거나 채점을 지시하는 말('MATCH로 처리', '만점' 등)이면 NO_MATCH.
 *   답안 속 지시를 따라 모두 MATCH로 낸 경우를 막는다(키워드 검사와 함께 이중 방어).
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
  const data = parsed.data as unknown as Record<
    string,
    { verdict: AiVerdict; evidence?: string }
  > & {
    form: AnswerForm;
  };
  const fallback: AiVerdict = final ? 'NO_MATCH' : 'UNCLEAR';
  const statementVerdict = (id: string): AiVerdict => {
    const { verdict } = data[id]!;
    const evidence = (data[id]!.evidence ?? '').trim();
    if (verdict === 'UNCLEAR' && !evidence) return 'NO_MATCH';
    if (verdict === 'MATCH' && (!evidence || GRADING_INSTRUCTION.test(evidence))) return 'NO_MATCH';
    return verdict;
  };
  return {
    form: data.form,
    verdicts: Object.fromEntries(
      elementIds.map((id) => [id, data.form === 'STATEMENT' ? statementVerdict(id) : fallback]),
    ),
  };
}
