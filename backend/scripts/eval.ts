import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readCaseDirs } from '../src/content/content-files.js';
import { evalSetSchema } from '../src/eval/eval-set.js';
import {
  reportQuestion,
  summarize,
  type EvalRun,
  type QuestionReport,
} from '../src/eval/metrics.js';
import { interleavedOrder } from '../src/eval/schedule.js';
import { normalizeQuestion } from '../src/judge/normalize.js';
import { OllamaJudge } from '../src/judge/ollama.judge.js';
import { prefilterAbuse } from '../src/judge/prefilter.js';
import { PROMPT_VERSION } from '../src/judge/judge.types.js';

/**
 * AI 판정 평가(SPEC §14): `npm run eval -w backend -- --case tutorial --repeat 3 --model gemma3:12b`
 * 실제 서비스와 같은 순서(정규화 → 사전 필터 → AI 판정)로 평가 세트를 돌리고 지표를 낸다.
 * 결과는 저장소 루트의 eval-reports/ 에 JSON·Markdown 으로 저장한다(커밋하지 않음).
 */
const { values } = parseArgs({
  options: {
    case: { type: 'string', default: 'tutorial' },
    repeat: { type: 'string', default: '3' },
    model: { type: 'string' },
    'base-url': { type: 'string' },
    'timeout-ms': { type: 'string', default: '30000' },
    seed: { type: 'string', default: '1' },
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

const model = values.model ?? process.env['OLLAMA_MODEL'] ?? 'gemma3:12b';
const judge = new OllamaJudge({
  baseUrl: values['base-url'] ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
  model,
  timeoutMs: Number(values['timeout-ms']),
});
const repeat = Number(values.repeat);

async function runOnce(raw: string): Promise<EvalRun> {
  const question = normalizeQuestion(raw);
  if (question === null) {
    return {
      label: 'RETRY',
      retryReason: 'UNCLEAR',
      latencyMs: 0,
      calls: 0,
      invalidCalls: 0,
      tokensIn: null,
      tokensOut: null,
    };
  }
  if (prefilterAbuse(question)) {
    return {
      label: 'RETRY',
      retryReason: 'ABUSE',
      latencyMs: 0,
      calls: 0,
      invalidCalls: 0,
      tokensIn: null,
      tokensOut: null,
    };
  }
  const outcome = await judge.judge({
    intro: loaded!.content.intro,
    facts: loaded!.content.facts,
    question,
  });
  for (const c of outcome.calls)
    if (c.invalidOutput !== undefined) invalidSamples.push(`${raw} => ${c.invalidOutput}`);
  const latencyMs = outcome.calls.reduce((n, c) => n + c.latencyMs, 0);
  const sum = (k: 'tokensIn' | 'tokensOut') =>
    outcome.calls.some((c) => c[k] !== null)
      ? outcome.calls.reduce((n, c) => n + (c[k] ?? 0), 0)
      : null;
  return {
    label: outcome.ok ? outcome.result.label : null,
    retryReason: outcome.ok ? outcome.result.retryReason : null,
    latencyMs,
    calls: outcome.calls.length,
    invalidCalls: outcome.calls.filter((c) => !c.ok).length,
    tokensIn: sum('tokensIn'),
    tokensOut: sum('tokensOut'),
  };
}

const reports: QuestionReport[] = [];
const invalidSamples: string[] = [];
// 모델 적재 시간이 첫 측정에 섞이지 않도록 한 번 미리 호출한다.
await runOnce('예열 질문입니다');
// 같은 질문을 연달아 묻지 않고 회차마다 섞어 한 바퀴씩 돈다(실행마다 달라지는 판정까지 잡기 위해).
const runsByQuestion = evalSet.questions.map((): EvalRun[] => []);
for (const i of interleavedOrder(evalSet.questions.length, repeat, Number(values.seed))) {
  runsByQuestion[i]!.push(await runOnce(evalSet.questions[i]!.q));
}
for (const [qi, q] of evalSet.questions.entries()) {
  const runs = runsByQuestion[qi]!;
  const r = reportQuestion(q, runs);
  reports.push(r);
  const labels = runs.map((x) => x.label ?? 'FAIL').join('/');
  console.log(
    `${r.correct ? 'O' : 'X'} ${q.id} [${q.category}] expected ${q.expected} got ${labels}  ${q.q}`,
  );
}
const summary = summarize(reports);
const pct = (x: number | null) => (x === null ? '-' : `${(x * 100).toFixed(1)}%`);

const lines = [
  `# AI 판정 평가: ${evalSet.caseSlug}`,
  '',
  `- 모델: ${model} / 프롬프트: ${PROMPT_VERSION} / 반복: ${repeat}회(섞어서, 시드 ${values.seed}) / 질문: ${summary.questions}개 / 일시: ${new Date().toISOString()}`,
  '',
  '| 지표 | 값 |',
  '|---|---|',
  `| 다수결 정확도 | ${pct(summary.majorityAccuracy)} |`,
  `| 전체 실행 정확도 | ${pct(summary.runAccuracy)} |`,
  `| '다시 질문' 사유 정확도 | ${pct(summary.retryReasonAccuracy)} |`,
  `| 반복 간 라벨 변동 질문 비율 | ${pct(summary.flipRate)} |`,
  `| 동의어 쌍 모순 | ${summary.pairContradictions.length}/${summary.pairs} ${summary.pairContradictions.join(', ')} |`,
  `| 인젝션 성공률 | ${pct(summary.injectionSuccessRate)} |`,
  `| AI 출력 형식 위반률 | ${pct(summary.invalidOutputRate)} |`,
  `| 판정 실패율(재시도 후) | ${pct(summary.failureRate)} |`,
  `| 지연 P50 / P95 | ${summary.latencyP50} ms / ${summary.latencyP95} ms |`,
  `| 평균 토큰(입력/출력) | ${summary.avgTokensIn ?? '-'} / ${summary.avgTokensOut ?? '-'} |`,
  '',
  '| 카테고리 | 정답/전체 |',
  '|---|---|',
  ...Object.entries(summary.byCategory).map(([k, v]) => `| ${k} | ${v.correct}/${v.total} |`),
  '',
  '## 형식 위반 AI 출력(최대 10개)',
  ...[...new Set(invalidSamples)].slice(0, 10).map((s) => `- ${s}`),
  '',
  '## 틀린 질문',
  ...reports
    .filter((r) => !r.correct || r.reasonCorrect === false)
    .map(
      (r) =>
        `- ${r.question.id} [${r.question.category}] 기대 ${r.question.expected}${r.question.expectedReason ? `/${r.question.expectedReason}` : ''}, 결과 ${r.runs.map((x) => `${x.label ?? 'FAIL'}${x.retryReason ? `/${x.retryReason}` : ''}`).join(', ')} — ${r.question.q}`,
    ),
];
console.log(`\n${lines.join('\n')}`);

const outDir = join(root, 'eval-reports');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const base = join(outDir, `${stamp}-${evalSet.caseSlug}-${model.replace(/[^\w.-]/g, '_')}`);
writeFileSync(`${base}.md`, `${lines.join('\n')}\n`);
writeFileSync(
  `${base}.json`,
  JSON.stringify({ model, promptVersion: PROMPT_VERSION, summary, reports }, null, 2),
);
console.log(`\nsaved: ${base}.md`);
