import type { Fact, QuestionLabel, RetryReason } from '@mysterytalk/shared';

export type JudgeInput = {
  /** 사건 도입 이야기(공개 정보) */
  intro: string;
  /** 판정 근거 사실 목록(비공개). 탐정 이름·메모·이전 질문 기록은 넣지 않는다(SPEC §1). */
  facts: Fact[];
  question: string;
};

export type JudgeResult = {
  label: QuestionLabel;
  retryReason: RetryReason | null;
  factIds: string[];
};

export type JudgeCallMeta = {
  model: string;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  ok: boolean;
  /** 형식 위반일 때의 AI 원문(평가 도구 진단용). 서비스는 이 값을 로그·DB에 남기지 않는다. */
  invalidOutput?: string;
};

export type JudgeOutcome =
  | { ok: true; result: JudgeResult; calls: JudgeCallMeta[] }
  | { ok: false; reason: 'timeout' | 'invalid_output' | 'unreachable'; calls: JudgeCallMeta[] };

/** 판정 AI 어댑터. 구현: Ollama(개발·평가), Mock(테스트), 이후 클라우드 AI(배포, PRD D45). */
export interface Judge {
  readonly model: string;
  judge(input: JudgeInput): Promise<JudgeOutcome>;
}

export const JUDGE = Symbol('JUDGE');
export const PROMPT_VERSION = 'judge-v2';
