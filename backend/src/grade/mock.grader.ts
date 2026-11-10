import { keywordMatch, type AiVerdict } from './decide.js';
import type { AnswerForm } from './grade-output.js';
import type { Grader, GraderInput, GraderOutcome } from './grader.types.js';

const meta = (model: string, ok: boolean) => ({
  model,
  latencyMs: 0,
  tokensIn: null,
  tokensOut: null,
  ok,
});

/**
 * AI 없이 동작하는 채점기(개발·CI). 키워드가 맞은 요소는 MATCH, 아니면 NO_MATCH로 답해
 * 키워드 판정과 항상 합의한다(결정적). 동의어·키워드 나열 같은 채점 품질 평가에는 쓰지 않는다.
 */
export class MockGrader implements Grader {
  readonly model = 'mock';

  grade(input: GraderInput): Promise<GraderOutcome> {
    const verdicts = Object.fromEntries(
      input.elements.map((e) => [
        e.id,
        keywordMatch(input.answer, e.keywordGroups) ? 'MATCH' : 'NO_MATCH',
      ]),
    ) as Record<string, AiVerdict>;
    return Promise.resolve({
      ok: true,
      form: 'STATEMENT',
      verdicts,
      calls: [meta(this.model, true)],
    });
  }
}

/**
 * 테스트용 채점기. 답안마다 요소별 판정(또는 실패)과 답안 형식을 정해 둔다. 정하지 않은 요소는 NO_MATCH.
 * 실제 파서와 같게: 형식이 문장이 아니면 모든 요소를 UNCLEAR(마지막 판정은 NO_MATCH)로 돌리고,
 * 마지막 판정에서는 UNCLEAR를 낼 수 없다.
 */
export class ScriptedGrader implements Grader {
  readonly model = 'scripted';
  readonly received: GraderInput[] = [];
  private readonly script = new Map<string, Record<string, AiVerdict> | 'fail'>();
  private readonly forms = new Map<string, AnswerForm>();

  set(
    answer: string,
    outcome: Record<string, AiVerdict> | 'fail',
    form: AnswerForm = 'STATEMENT',
  ): this {
    this.script.set(answer, outcome);
    this.forms.set(answer, form);
    return this;
  }

  reset(): void {
    this.script.clear();
    this.forms.clear();
    this.received.length = 0;
  }

  grade(input: GraderInput): Promise<GraderOutcome> {
    this.received.push(input);
    const outcome = this.script.get(input.answer);
    if (outcome === 'fail') {
      return Promise.resolve({ ok: false, reason: 'timeout', calls: [meta(this.model, false)] });
    }
    const form = this.forms.get(input.answer) ?? 'STATEMENT';
    const fallback: AiVerdict = input.final ? 'NO_MATCH' : 'UNCLEAR';
    const verdicts = Object.fromEntries(
      input.elements.map((e) => {
        const v = outcome?.[e.id] ?? 'NO_MATCH';
        if (form !== 'STATEMENT') return [e.id, fallback];
        return [e.id, input.final && v === 'UNCLEAR' ? 'NO_MATCH' : v];
      }),
    ) as Record<string, AiVerdict>;
    return Promise.resolve({ ok: true, form, verdicts, calls: [meta(this.model, true)] });
  }
}
