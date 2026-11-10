import { QUESTION_LABELS, RETRY_REASONS } from '@mysterytalk/shared';
import { z } from 'zod';

/** 사건별 평가 세트(`eval.json`, SPEC §14 AI 평가) */
export const evalSetSchema = z.object({
  caseSlug: z.string(),
  note: z.string().optional(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        category: z.string(),
        q: z.string(),
        expected: z.enum(QUESTION_LABELS),
        /** expected 외에 정답으로 인정할 라벨 */
        accept: z.array(z.enum(QUESTION_LABELS)).optional(),
        expectedReason: z.enum(RETRY_REASONS).optional(),
        /** 같은 의미 질문 쌍(모순 측정) */
        pairId: z.string().optional(),
      }),
    )
    .min(1),
  /** 정답 채점 평가용 답안(SPEC §14: 동의어·키워드 나열·부분 정답) */
  answers: z
    .array(
      z.object({
        id: z.string(),
        category: z.string(),
        answer: z.string(),
        expected: z.enum(['SOLVED', 'WRONG', 'NEEDS_DETAIL']),
        /** expected 외에 정답으로 인정할 결과 */
        accept: z.array(z.enum(['SOLVED', 'WRONG', 'NEEDS_DETAIL'])).optional(),
        /** 재작성 요청을 다 쓴 뒤 마지막 판정의 기대 결과. 없으면 expected(재작성 요청은 나올 수 없다) */
        expectedFinal: z.enum(['SOLVED', 'WRONG']).optional(),
      }),
    )
    .default([]),
});
export type EvalSet = z.infer<typeof evalSetSchema>;
export type EvalQuestion = EvalSet['questions'][number];
export type EvalAnswer = EvalSet['answers'][number];
