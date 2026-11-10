import { JUDGE_OUTPUT_JSON_SCHEMA, parseJudgeOutput } from './judge-output.js';
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserMessage } from './prompt.js';
import type { Judge, JudgeCallMeta, JudgeInput, JudgeOutcome } from './judge.types.js';

type OllamaChatResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

export type OllamaJudgeOptions = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

/**
 * 로컬 Ollama 판정 어댑터(PRD D45). 구조화 출력(format=JSON 스키마), 생각 모드 끔, temperature 0.
 * 타임아웃·형식 위반은 1회 재시도하고, 그래도 실패하면 실패를 돌려준다(SPEC §6-9·10).
 */
export class OllamaJudge implements Judge {
  readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OllamaJudgeOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async judge(input: JudgeInput): Promise<JudgeOutcome> {
    const calls: JudgeCallMeta[] = [];
    let lastReason: 'timeout' | 'invalid_output' | 'unreachable' = 'unreachable';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const started = Date.now();
      try {
        const res = await this.fetchImpl(`${this.options.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(this.options.timeoutMs),
          body: JSON.stringify({
            model: this.model,
            stream: false,
            think: false,
            format: JUDGE_OUTPUT_JSON_SCHEMA,
            keep_alive: '10m',
            options: { temperature: 0, num_predict: 256, num_ctx: 4096 },
            messages: [
              { role: 'system', content: JUDGE_SYSTEM_PROMPT },
              { role: 'user', content: buildJudgeUserMessage(input) },
            ],
          }),
        });
        const latencyMs = Date.now() - started;
        if (!res.ok) {
          calls.push({ model: this.model, latencyMs, tokensIn: null, tokensOut: null, ok: false });
          lastReason = 'unreachable';
          continue;
        }
        const body = (await res.json()) as OllamaChatResponse;
        const content = body.message?.content ?? '';
        const result = parseJudgeOutput(content, input.facts);
        const meta: JudgeCallMeta = {
          model: this.model,
          latencyMs,
          tokensIn: body.prompt_eval_count ?? null,
          tokensOut: body.eval_count ?? null,
          ok: result !== null,
          ...(result === null ? { invalidOutput: content.slice(0, 500) } : {}),
        };
        calls.push(meta);
        if (result) return { ok: true, result, calls };
        lastReason = 'invalid_output';
      } catch (error) {
        const latencyMs = Date.now() - started;
        calls.push({ model: this.model, latencyMs, tokensIn: null, tokensOut: null, ok: false });
        lastReason = (error as Error).name === 'TimeoutError' ? 'timeout' : 'unreachable';
      }
    }
    return { ok: false, reason: lastReason, calls };
  }
}
