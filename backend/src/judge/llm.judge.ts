import {
  JUDGE_OUTPUT_JSON_SCHEMA,
  JUDGE_SINGLE_OUTPUT_JSON_SCHEMA,
  parseJudgeOutput,
} from './judge-output.js';
import type { LlmChat } from './ollama-client.js';
import { JUDGE_SYSTEM_PROMPT, SINGLE_QUESTION_NOTE, buildJudgeUserMessage } from './prompt.js';
import type { Judge, JudgeCallMeta, JudgeInput, JudgeOutcome } from './judge.types.js';
import type { PositiveCheck } from './negation.js';
import {
  POSITIVE_CHECK_JSON_SCHEMA,
  POSITIVE_CHECK_SYSTEM_PROMPT,
  buildPositiveCheckMessage,
  parsePositiveCheck,
} from './positive-check.js';

/** model: 비용·기록용 모델 이름, chat: 공급자별 호출(ollamaChatFn·anthropicChat) */
export type LlmJudgeOptions = { model: string; chat: LlmChat };

/**
 * 판정 어댑터(PRD D45). 공급자(로컬 Ollama, 클라우드 Claude)는 chat 으로 주입하고,
 * 프롬프트·구조화 출력 스키마·검증·재시도는 공급자와 무관하게 같다.
 * 타임아웃·형식 위반은 1회 재시도하고, 그래도 실패하면 실패를 돌려준다(SPEC §6-9·10).
 */
export class LlmJudge implements Judge {
  readonly model: string;
  private readonly chat: LlmChat;

  constructor(options: LlmJudgeOptions) {
    this.model = options.model;
    this.chat = options.chat;
  }

  async judge(input: JudgeInput): Promise<JudgeOutcome> {
    return this.run(input, buildJudgeUserMessage(input), JUDGE_OUTPUT_JSON_SCHEMA);
  }

  /** 복합 질문 오판 보정: '다시 질문'을 고를 수 없게 한 번 더 판정한다(compound-guard). */
  async judgeSingle(input: JudgeInput): Promise<JudgeOutcome> {
    return this.run(
      input,
      `${buildJudgeUserMessage(input)}\n\n${SINGLE_QUESTION_NOTE}`,
      JUDGE_SINGLE_OUTPUT_JSON_SCHEMA,
    );
  }

  private async run(input: JudgeInput, user: string, format: object): Promise<JudgeOutcome> {
    const calls: JudgeCallMeta[] = [];
    let lastReason: 'timeout' | 'invalid_output' | 'unreachable' = 'unreachable';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reply = await this.chat({
        system: JUDGE_SYSTEM_PROMPT,
        user,
        format,
        numPredict: 256,
      });
      if (!reply.ok) {
        calls.push({
          model: this.model,
          latencyMs: reply.latencyMs,
          tokensIn: null,
          tokensOut: null,
          ok: false,
        });
        lastReason = reply.reason;
        continue;
      }
      const result = parseJudgeOutput(reply.content, input.facts);
      calls.push({
        model: this.model,
        latencyMs: reply.latencyMs,
        tokensIn: reply.tokensIn,
        tokensOut: reply.tokensOut,
        ok: result !== null,
        ...(result === null ? { invalidOutput: reply.content.slice(0, 500) } : {}),
      });
      if (result) return { ok: true, result, calls };
      lastReason = 'invalid_output';
    }
    return { ok: false, reason: lastReason, calls };
  }

  /** 부정형 질문 재확인: 긍정 명제의 참·거짓을 판정한다(1회 재시도). */
  async verifyPositive(input: JudgeInput): Promise<PositiveCheck> {
    const calls: JudgeCallMeta[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reply = await this.chat({
        system: POSITIVE_CHECK_SYSTEM_PROMPT,
        user: buildPositiveCheckMessage(input),
        format: POSITIVE_CHECK_JSON_SCHEMA,
        numPredict: 256,
      });
      if (!reply.ok) {
        calls.push({
          model: this.model,
          latencyMs: reply.latencyMs,
          tokensIn: null,
          tokensOut: null,
          ok: false,
        });
        continue;
      }
      const parsed = parsePositiveCheck(reply.content, input.facts);
      calls.push({
        model: this.model,
        latencyMs: reply.latencyMs,
        tokensIn: reply.tokensIn,
        tokensOut: reply.tokensOut,
        ok: parsed !== null,
      });
      if (parsed) return { ok: true, ...parsed, calls };
    }
    return { ok: false, calls };
  }
}
