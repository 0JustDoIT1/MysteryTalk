import type { JudgeCallMeta } from '../judge/judge.types.js';
import type { LlmChat } from '../judge/ollama-client.js';
import { gradeOutputJsonSchema, parseGradeOutput } from './grade-output.js';
import { GRADE_SYSTEM_PROMPT, buildGradeUserMessage } from './grade-prompt.js';
import type { Grader, GraderInput, GraderOutcome } from './grader.types.js';

/** 채점 어댑터. 공급자는 chat 으로 주입한다(판정기와 같은 방식). 타임아웃·형식 위반은 1회 재시도(SPEC §7-7). */
export class LlmGrader implements Grader {
  readonly model: string;
  private readonly chat: LlmChat;

  constructor(options: { model: string; chat: LlmChat }) {
    this.model = options.model;
    this.chat = options.chat;
  }

  async grade(input: GraderInput): Promise<GraderOutcome> {
    const ids = input.elements.map((e) => e.id);
    const calls: JudgeCallMeta[] = [];
    let lastReason: 'timeout' | 'invalid_output' | 'unreachable' = 'unreachable';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reply = await this.chat({
        system: GRADE_SYSTEM_PROMPT,
        user: buildGradeUserMessage(input),
        format: gradeOutputJsonSchema(ids, input.final),
        numPredict: 120 * ids.length + 64,
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
      const output = parseGradeOutput(reply.content, ids, input.final);
      calls.push({
        model: this.model,
        latencyMs: reply.latencyMs,
        tokensIn: reply.tokensIn,
        tokensOut: reply.tokensOut,
        ok: output !== null,
        ...(output === null ? { invalidOutput: reply.content.slice(0, 500) } : {}),
      });
      if (output) return { ok: true, ...output, calls };
      lastReason = 'invalid_output';
    }
    return { ok: false, reason: lastReason, calls };
  }
}
