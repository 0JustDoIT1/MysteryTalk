import { z } from 'zod';
import { difficultySchema, genreSchema, ratingSchema, caseFileSchema } from './content.js';
import { caseRecordSchema } from './play.js';

/** 판정 라벨(PRD §5.2). RETRY = '다시 질문해 주세요'(질문 수 미차감, D1) */
export const QUESTION_LABELS = ['YES', 'NO', 'MAYBE', 'IRRELEVANT', 'RETRY'] as const;
export const questionLabelSchema = z.enum(QUESTION_LABELS);
export type QuestionLabel = z.infer<typeof questionLabelSchema>;

/** '다시 질문'의 사유(D1, D57) */
export const RETRY_REASONS = ['COMPOUND', 'OPEN', 'ASKS_ANSWER', 'UNCLEAR', 'ABUSE'] as const;
export const retryReasonSchema = z.enum(RETRY_REASONS);
export type RetryReason = z.infer<typeof retryReasonSchema>;

/** 질문 수를 차감하는 라벨(D68) */
export const COUNTED_LABELS: readonly QuestionLabel[] = ['YES', 'NO', 'MAYBE', 'IRRELEVANT'];

/** 화면 고정 문구. 서버는 코드만 보내고 클라이언트가 표시한다. */
export const LABEL_TEXT: Record<QuestionLabel, string> = {
  YES: '예',
  NO: '아니오',
  MAYBE: '그럴 수도',
  IRRELEVANT: '관계없음',
  RETRY: '다시 질문해 주세요',
};

export const RETRY_REASON_TEXT: Record<RetryReason, string> = {
  COMPOUND: '한 번에 하나만 물어봐 주세요.',
  OPEN: '예/아니오로 답할 수 있게 물어봐 주세요.',
  ASKS_ANSWER: '정답을 직접 알려 드릴 수는 없어요.',
  UNCLEAR: '질문을 조금 더 분명하게 써 주세요.',
  ABUSE: '사건과 관련된 예/아니오 질문을 해 주세요.',
};

/** 질문 길이(PRD D8) */
export const QUESTION_MIN_LENGTH = 2;
export const QUESTION_MAX_LENGTH = 100;

export const askQuestionRequestSchema = z.object({
  question: z.string(),
});
export type AskQuestionRequest = z.infer<typeof askQuestionRequestSchema>;

/** POST /sessions/{id}/questions 응답 */
export const askQuestionResponseSchema = z.object({
  label: questionLabelSchema,
  retryReason: retryReasonSchema.nullable(),
  /** 같은 문장을 다시 물어 이전 판정을 돌려준 경우(D5, 미차감) */
  duplicate: z.boolean(),
  counted: z.boolean(),
  turnNo: z.number().int().nullable(),
  questionsUsed: z.number().int(),
  baseQuestions: z.number().int(),
  questionCap: z.number().int(),
});
export type AskQuestionResponse = z.infer<typeof askQuestionResponseSchema>;

export const questionLogItemSchema = z.object({
  turnNo: z.number().int().nullable(),
  question: z.string(),
  label: questionLabelSchema,
  retryReason: retryReasonSchema.nullable(),
  createdAt: z.string(),
});
export type QuestionLogItem = z.infer<typeof questionLogItemSchema>;

/** GET /cases 항목 */
export const caseSummarySchema = z.object({
  slug: z.string(),
  isTutorial: z.boolean(),
  title: z.string(),
  summary: z.string(),
  difficulty: difficultySchema,
  rating: ratingSchema,
  tags: z.array(z.string()),
  genres: z.array(genreSchema),
  activeSessionId: z.uuid().nullable(),
  /** 개인 기록(튜토리얼·미플레이는 null) */
  record: caseRecordSchema.nullable(),
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

/** GET /cases/{slug}: 공개 정보만(사실 목록·정답 요소·힌트·해설 제외) */
export const caseDetailSchema = z.object({
  slug: z.string(),
  isTutorial: z.boolean(),
  title: z.string(),
  intro: z.string(),
  caseFile: caseFileSchema,
  difficulty: difficultySchema,
  baseQuestions: z.number().int(),
  rating: ratingSchema,
  tags: z.array(z.string()),
  genres: z.array(genreSchema),
});
export type CaseDetail = z.infer<typeof caseDetailSchema>;

export const createSessionResponseSchema = z.object({ sessionId: z.uuid() });
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
