import type { Judge, JudgeInput, JudgeOutcome, JudgeResult } from './judge.types.js';
import type { PositiveCheck } from './negation.js';

/**
 * AI 없이 동작하는 판정기. 개발 중 Ollama를 켜지 않았을 때와 CI에서 쓴다.
 * 모든 질문에 IRRELEVANT로 답한다(사실을 지어내지 않는 가장 안전한 값). 판정 품질 평가에는 쓰지 않는다.
 */
export class MockJudge implements Judge {
  readonly model = 'mock';

  judge(): Promise<JudgeOutcome> {
    return Promise.resolve({
      ok: true,
      result: { label: 'IRRELEVANT', retryReason: null, factIds: [] },
      calls: [{ model: this.model, latencyMs: 0, tokensIn: null, tokensOut: null, ok: true }],
    });
  }
}

/**
 * 테스트용 판정기. 질문마다 돌려줄 결과(또는 실패)를 미리 정해 둔다.
 * 정해 두지 않은 질문은 IRRELEVANT.
 */
export class ScriptedJudge implements Judge {
  readonly model = 'scripted';
  readonly received: JudgeInput[] = [];
  private readonly script = new Map<string, JudgeResult | 'fail'>();
  /** 부정형 재확인 응답(질문별). 정하지 않은 질문은 판단 불가(UNKNOWN) */
  private readonly positive = new Map<string, { truth: 'TRUE' | 'FALSE'; factIds: string[] }>();
  readonly positiveChecked: string[] = [];
  private delayMs = 0;

  set(question: string, outcome: JudgeResult | 'fail'): this {
    this.script.set(question, outcome);
    return this;
  }

  setDelay(ms: number): this {
    this.delayMs = ms;
    return this;
  }

  reset(): void {
    this.script.clear();
    this.positive.clear();
    this.positiveChecked.length = 0;
    this.received.length = 0;
    this.delayMs = 0;
  }

  async judge(input: JudgeInput): Promise<JudgeOutcome> {
    this.received.push(input);
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const meta = { model: this.model, latencyMs: this.delayMs, tokensIn: null, tokensOut: null };
    const outcome = this.script.get(input.question);
    if (outcome === 'fail') {
      return { ok: false, reason: 'timeout', calls: [{ ...meta, ok: false }] };
    }
    return {
      ok: true,
      result: outcome ?? { label: 'IRRELEVANT', retryReason: null, factIds: [] },
      calls: [{ ...meta, ok: true }],
    };
  }

  setPositive(question: string, truth: 'TRUE' | 'FALSE', factIds: string[]): this {
    this.positive.set(question, { truth, factIds });
    return this;
  }

  verifyPositive(input: JudgeInput): Promise<PositiveCheck> {
    this.positiveChecked.push(input.question);
    const p = this.positive.get(input.question);
    const calls = [{ model: this.model, latencyMs: 0, tokensIn: null, tokensOut: null, ok: true }];
    return Promise.resolve(
      p ? { ok: true, ...p, calls } : { ok: true, truth: 'UNKNOWN', factIds: [], calls },
    );
  }
}
