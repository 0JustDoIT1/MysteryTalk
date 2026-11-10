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
});
export type EvalSet = z.infer<typeof evalSetSchema>;
export type EvalQuestion = EvalSet['questions'][number];
