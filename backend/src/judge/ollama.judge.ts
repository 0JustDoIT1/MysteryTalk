import { JUDGE_OUTPUT_JSON_SCHEMA, parseJudgeOutput } from './judge-output.js';
import { ollamaChat, type OllamaOptions } from './ollama-client.js';
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserMessage } from './prompt.js';
import type { Judge, JudgeCallMeta, JudgeInput, JudgeOutcome } from './judge.types.js';
import type { PositiveCheck } from './negation.js';
import {
  POSITIVE_CHECK_JSON_SCHEMA,
  POSITIVE_CHECK_SYSTEM_PROMPT,
  buildPositiveCheckMessage,
  parsePositiveCheck,
} from './positive-check.js';

export type OllamaJudgeOptions = OllamaOptions;

/**
 * 로컬 Ollama 판정 어댑터(PRD D45). 구조화 출력(format=JSON 스키마), 생각 모드 끔, temperature 0.
 * 타임아웃·형식 위반은 1회 재시도하고, 그래도 실패하면 실패를 돌려준다(SPEC §6-9·10).
 */
export class OllamaJudge implements Judge {
  readonly model: string;

  constructor(private readonly options: OllamaJudgeOptions) {
    this.model = options.model;
  }

  async judge(input: JudgeInput): Promise<JudgeOutcome> {
    const calls: JudgeCallMeta[] = [];
    let lastReason: 'timeout' | 'invalid_output' | 'unreachable' = 'unreachable';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reply = await ollamaChat(this.options, {
        system: JUDGE_SYSTEM_PROMPT,
        user: buildJudgeUserMessage(input),
        format: JUDGE_OUTPUT_JSON_SCHEMA,
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
      const reply = await ollamaChat(this.options, {
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
