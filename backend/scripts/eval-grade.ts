import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readCaseDirs } from '../src/content/content-files.js';
import { evalSetSchema } from '../src/eval/eval-set.js';
import { percentile } from '../src/eval/metrics.js';
import { decide, type AiVerdict } from '../src/grade/decide.js';
import { GRADE_PROMPT_VERSION } from '../src/grade/grader.types.js';
import { OllamaGrader } from '../src/grade/ollama.grader.js';
import { normalizeAnswer } from '../src/judge/normalize.js';

/**
 * AI 정답 채점 평가(SPEC §14): `npm run eval:grade -w backend -- --case sample --repeat 3`
 * 평가 세트의 answers 를 실제 서비스와 같은 순서(정규화 → AI 요소별 판정 → 키워드 합의 → 결과 결정)로 돌린다.
 * 재작성 요청 전(첫 제출) 기준 결과를 비교한다. 결과는 eval-reports/ 에 저장한다(커밋하지 않음).
 */
const { values } = parseArgs({
  options: {
    case: { type: 'string', default: 'sample' },
    repeat: { type: 'string', default: '3' },
    model: { type: 'string' },
    'base-url': { type: 'string' },
    'timeout-ms': { type: 'string', default: '60000' },
    /** 재작성 요청을 다 쓴 뒤의 마지막 판정(MATCH/NO_MATCH만)으로 평가 */
    final: { type: 'boolean', default: false },
  },
});

const root = resolve(import.meta.dirname, '../..');
const caseRoot = process.env['CASE_DATA_DIR'];
const roots = [join(root, 'content/public'), ...(caseRoot ? [resolve(caseRoot)] : [])];
const loaded = readCaseDirs(roots).find(
  (c) => c.content.slug === values.case || c.dir.endsWith(values.case!),
);
if (!loaded) throw new Error(`case not found: ${values.case}`);
const evalSet = evalSetSchema.parse(
  JSON.parse(readFileSync(join(loaded.dir, 'eval.json'), 'utf8')),
);
const content = loaded.content;

const model = values.model ?? process.env['OLLAMA_MODEL'] ?? 'gemma3:12b';
const grader = new OllamaGrader({
  baseUrl: values['base-url'] ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
  model,
  timeoutMs: Number(values['timeout-ms']),
});
const repeat = Number(values.repeat);

/** 가장 많이 나온 결과(동률이면 먼저 나온 것) */
function majority(results: (string | null)[]): string | null {
  const counts = new Map<string | null, number>();
  for (const r of results) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, n] of counts) if (n > bestCount) [best, bestCount] = [k, n];
  return best;
}

type Run = {
  result: string | null;
  verdicts: Record<string, AiVerdict> | null;
  latencyMs: number;
  invalidCalls: number;
  calls: number;
};

async function runOnce(raw: string): Promise<Run> {
  const answer = normalizeAnswer(raw);
  if (answer === null)
    return { result: 'INVALID_INPUT', verdicts: null, latencyMs: 0, invalidCalls: 0, calls: 0 };
  const outcome = await grader.grade({
    intro: content.intro,
    facts: content.facts,
    elements: content.elements.map((e) => ({
      id: e.id,
      description: e.description,
      keywordGroups: e.keywordGroups,
    })),
    answer,
    final: values.final!,
  });
  const latencyMs = outcome.calls.reduce((n, c) => n + c.latencyMs, 0);
  const invalidCalls = outcome.calls.filter((c) => !c.ok).length;
  if (!outcome.ok)
    return { result: null, verdicts: null, latencyMs, invalidCalls, calls: outcome.calls.length };
  const decision = decide(content.elements, answer, outcome.verdicts, values.final!);
  return {
    result: decision.result,
    verdicts: outcome.verdicts,
    latencyMs,
    invalidCalls,
    calls: outcome.calls.length,
  };
}

await runOnce('예열용 답안입니다. 아무 내용이나 적습니다.');
const rows: {
  id: string;
  category: string;
  answer: string;
  expected: string;
  runs: Run[];
  correct: boolean;
}[] = [];
for (const a of evalSet.answers) {
  const runs: Run[] = [];
  for (let i = 0; i < repeat; i += 1) runs.push(await runOnce(a.answer));
  const top = majority(runs.map((r) => r.result));
  const expected = values.final ? (a.expectedFinal ?? a.expected) : a.expected;
  if (values.final && expected === 'NEEDS_DETAIL')
    throw new Error(`${a.id}: expectedFinal is required for --final`);
  const ok: string[] = values.final ? [expected] : [expected, ...(a.accept ?? [])];
  const correct = top !== null && ok.includes(top);
  rows.push({
    id: a.id,
    category: a.category,
    answer: a.answer,
    expected,
    runs,
    correct,
  });
  console.log(
    `${correct ? 'O' : 'X'} ${a.id} [${a.category}] expected ${a.expected} got ${runs.map((r) => r.result ?? 'FAIL').join('/')}`,
  );
}

const allRuns = rows.flatMap((r) => r.runs);
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-');
const flips = rows.filter((r) => new Set(r.runs.map((x) => x.result)).size > 1).length;
const latencies = allRuns.filter((r) => r.calls > 0).map((r) => r.latencyMs);
const byCategory = new Map<string, { correct: number; total: number }>();
for (const r of rows) {
  const c = byCategory.get(r.category) ?? { correct: 0, total: 0 };
  c.total += 1;
  if (r.correct) c.correct += 1;
  byCategory.set(r.category, c);
}
const lines = [
  `# AI 채점 평가: ${evalSet.caseSlug}`,
  '',
  `- 모델: ${model} / 프롬프트: ${GRADE_PROMPT_VERSION}${values.final ? ' (마지막 판정)' : ''} / 반복: ${repeat}회 / 답안: ${rows.length}개 / 일시: ${new Date().toISOString()}`,
  '',
  '| 지표 | 값 |',
  '|---|---|',
  `| 다수결 정확도 | ${pct(rows.filter((r) => r.correct).length, rows.length)} |`,
  `| 반복 간 결과 변동 답안 비율 | ${pct(flips, rows.length)} |`,
  `| AI 출력 형식 위반률 | ${pct(
    allRuns.reduce((n, r) => n + r.invalidCalls, 0),
    allRuns.reduce((n, r) => n + r.calls, 0),
  )} |`,
  `| 채점 실패율(재시도 후) | ${pct(allRuns.filter((r) => r.result === null).length, allRuns.length)} |`,
  `| 지연 P50 / P95 | ${percentile(latencies, 50)} ms / ${percentile(latencies, 95)} ms |`,
  '',
  '| 카테고리 | 정답/전체 |',
  '|---|---|',
  ...[...byCategory].map(([k, v]) => `| ${k} | ${v.correct}/${v.total} |`),
  '',
  '## 틀린 답안',
  ...rows
    .filter((r) => !r.correct)
    .map(
      (r) =>
        `- ${r.id} [${r.category}] 기대 ${r.expected}, 결과 ${r.runs.map((x) => x.result ?? 'FAIL').join(', ')} — AI ${JSON.stringify(r.runs[0]?.verdicts)} — ${r.answer}`,
    ),
];
console.log(`\n${lines.join('\n')}`);

const outDir = join(root, 'eval-reports');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const base = join(outDir, `${stamp}-grade-${evalSet.caseSlug}-${model.replace(/[^\w.-]/g, '_')}`);
writeFileSync(`${base}.md`, `${lines.join('\n')}\n`);
writeFileSync(
  `${base}.json`,
  JSON.stringify({ model, promptVersion: GRADE_PROMPT_VERSION, rows }, null, 2),
);
console.log(`\nsaved: ${base}.md`);
