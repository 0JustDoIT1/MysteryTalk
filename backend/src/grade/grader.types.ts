import type { Fact } from '@mysterytalk/shared';
import type { JudgeCallMeta } from '../judge/judge.types.js';
import type { AiVerdict } from './decide.js';
import type { AnswerForm } from './grade-output.js';

export type GradeElement = {
  id: string;
  description: string;
  /** 키워드 Mock 전용. AI 프롬프트에는 넣지 않는다(키워드 유도 방지). */
  keywordGroups: string[][];
};

export type GraderInput = {
  intro: string;
  /** 동의어·호칭 해석용 사건 사실(비공개) */
  facts: Fact[];
  elements: GradeElement[];
  answer: string;
  /** 재작성 요청을 다 쓴 뒤의 마지막 판정이면 true: AI는 MATCH/NO_MATCH만 고른다(D23). */
  final: boolean;
};

export type GraderOutcome =
  | { ok: true; form: AnswerForm; verdicts: Record<string, AiVerdict>; calls: JudgeCallMeta[] }
  | { ok: false; reason: 'timeout' | 'invalid_output' | 'unreachable'; calls: JudgeCallMeta[] };

/** 정답 채점 AI 어댑터(SPEC §7-3). 구현: Ollama(개발·평가), 키워드 Mock(개발·CI), Scripted(테스트). */
export interface Grader {
  readonly model: string;
  grade(input: GraderInput): Promise<GraderOutcome>;
}

export const GRADER = Symbol('GRADER');
export const GRADE_PROMPT_VERSION = 'grade-v3';
