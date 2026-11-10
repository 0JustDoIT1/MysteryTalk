import { z } from 'zod';

export const sessionStatusSchema = z.enum(['ACTIVE', 'SOLVED', 'PARTIAL', 'FAILED', 'ABANDONED']);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

/** 등급(PRD §8.1). D = 부분 해결, F = 미해결·포기 */
export const GRADES = ['S', 'A', 'B', 'C', 'D', 'F'] as const;
export const gradeSchema = z.enum(GRADES);
export type Grade = z.infer<typeof gradeSchema>;

/** 정답 입력 길이(PRD D79) */
export const ANSWER_MIN_LENGTH = 10;
export const ANSWER_MAX_LENGTH = 300;
/** 정답 제출 기회(PRD D12) */
export const MAX_SUBMISSIONS = 3;
/** 채점 미확정 시 재작성 요청 최대 횟수(PRD D23) */
export const MAX_DETAIL_REQUESTS = 2;
/** 메모 길이(PRD D62). 수치는 구현 기본값 */
export const MEMO_MAX_LENGTH = 2000;

export const submitAnswerRequestSchema = z.object({ answer: z.string() });
export type SubmitAnswerRequest = z.infer<typeof submitAnswerRequestSchema>;

export const submissionResultSchema = z.enum(['SOLVED', 'WRONG', 'NEEDS_DETAIL']);
export type SubmissionResult = z.infer<typeof submissionResultSchema>;

/**
 * POST /sessions/{id}/submissions 응답.
 * 오답일 때만 '확정 일치 n개 / 필수 요소 m개'를 보여 준다(D21, D84). 재작성 요청에는 개수를 넣지 않는다.
 */
/** 재작성 요청 사유. FORM: 단어 나열·여러 가능성 나열, DETAIL: 내용이 모호함. 어떤 요소인지는 알려 주지 않는다(D84). */
export const detailReasonSchema = z.enum(['FORM', 'DETAIL']);
export type DetailReason = z.infer<typeof detailReasonSchema>;

export const submitAnswerResponseSchema = z.object({
  result: submissionResultSchema,
  /** NEEDS_DETAIL 일 때만 */
  detailReason: detailReasonSchema.nullable(),
  matchedCount: z.number().int().nullable(),
  totalCount: z.number().int().nullable(),
  submissionsLeft: z.number().int(),
  status: sessionStatusSchema,
});
export type SubmitAnswerResponse = z.infer<typeof submitAnswerResponseSchema>;

/** 힌트 한 개의 상태. 본문은 열람한 힌트만 담는다. */
export const hintStateSchema = z.object({
  no: z.number().int(),
  /** 이 질문 수에 도달하면 해금(⌈B/3⌉, ⌈2B/3⌉, B) */
  unlockAt: z.number().int(),
  unlocked: z.boolean(),
  viewed: z.boolean(),
  text: z.string().nullable(),
});
export type HintState = z.infer<typeof hintStateSchema>;

/** GET /sessions/{id}: 화면 복원용 진행 상태(D53, D76). 점수·등급은 넣지 않는다. */
export const sessionStateSchema = z.object({
  sessionId: z.uuid(),
  caseSlug: z.string(),
  isTutorial: z.boolean(),
  playNo: z.number().int(),
  status: sessionStatusSchema,
  questionsUsed: z.number().int(),
  baseQuestions: z.number().int(),
  questionCap: z.number().int(),
  wrongSubmissions: z.number().int(),
  submissionsLeft: z.number().int(),
  hints: z.array(hintStateSchema),
  memo: z.string(),
});
export type SessionState = z.infer<typeof sessionStateSchema>;

export const memoRequestSchema = z.object({ memo: z.string().max(MEMO_MAX_LENGTH) });
export type MemoRequest = z.infer<typeof memoRequestSchema>;

/** 점수 내역(SPEC §8). 튜토리얼 엔딩은 이 수치로 감점 규칙을 설명한다(PRD v1.3). */
export const scoreBreakdownSchema = z.object({
  base: z.number().int(),
  baseQuestions: z.number().int(),
  questionsUsed: z.number().int(),
  questionPenalty: z.number().int(),
  questionPenaltyPerExtra: z.number().int(),
  questionPenaltyMax: z.number().int(),
  hintsViewed: z.number().int(),
  hintPenalty: z.number().int(),
  /** 힌트 n번째 열람의 감점(예: [10, 15, 20]) */
  hintPenaltySteps: z.array(z.number().int()),
  wrongSubmissions: z.number().int(),
  wrongPenalty: z.number().int(),
  wrongPenaltyEach: z.number().int(),
  /** 등급 하한(예: S 90, A 80, B 70) */
  gradeCuts: z.object({ S: z.number().int(), A: z.number().int(), B: z.number().int() }),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

/** GET /sessions/{id}/ending: 종료된 세션에만 공개(D19, D61) */
export const endingSchema = z.object({
  caseSlug: z.string(),
  title: z.string(),
  isTutorial: z.boolean(),
  /** 개인 기록에 반영됐는지(튜토리얼은 false, D24) */
  recorded: z.boolean(),
  playNo: z.number().int(),
  status: sessionStatusSchema,
  grade: gradeSchema,
  score: z.number().int().nullable(),
  breakdown: scoreBreakdownSchema,
  /** 마지막 제출 기준 요소별 충족(제출이 없으면 모두 false) */
  elements: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      required: z.boolean(),
      matched: z.boolean(),
    }),
  ),
  explanation: z.string(),
});
export type Ending = z.infer<typeof endingSchema>;

/** 사건 목록에 붙는 개인 기록(D18) */
export const caseRecordSchema = z.object({
  bestGrade: gradeSchema,
  bestPlayNo: z.number().int(),
  totalPlays: z.number().int(),
  solved: z.boolean(),
});
export type CaseRecordSummary = z.infer<typeof caseRecordSchema>;
