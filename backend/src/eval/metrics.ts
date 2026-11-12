import type { QuestionLabel, RetryReason } from '@mysterytalk/shared';
import type { EvalQuestion } from './eval-set.js';

/** 한 질문의 반복 실행 결과. label null = 판정 실패(타임아웃·형식 위반 2회) */
export type EvalRun = {
  label: QuestionLabel | null;
  retryReason: RetryReason | null;
  latencyMs: number;
  calls: number;
  invalidCalls: number;
  tokensIn: number | null;
  tokensOut: number | null;
};

export type QuestionReport = {
  question: EvalQuestion;
  runs: EvalRun[];
  /** 가장 많이 나온 라벨(동률이면 먼저 나온 것) */
  majority: QuestionLabel | null;
  correct: boolean;
  reasonCorrect: boolean | null;
  flipped: boolean;
};

export type EvalSummary = {
  questions: number;
  repeats: number;
  /** 전체 실행 중 정답 비율 */
  runAccuracy: number;
  /** 다수결 라벨 기준 정답 비율 */
  majorityAccuracy: number;
  byCategory: Record<string, { total: number; correct: number }>;
  /** RETRY가 기대된 질문 중 사유까지 맞힌 비율(다수결이 RETRY인 것만) */
  retryReasonAccuracy: number | null;
  /** 반복 실행 사이에 라벨이 바뀐 질문 비율 */
  flipRate: number;
  /** 기대가 예/아니오인데 다수결이 그 반대(아니오/예)인 질문 id: 플레이어를 틀린 방향으로 이끄는 오답 */
  contradictions: string[];
  /** 같은 의미 질문 쌍 중 다수결 라벨이 다른 쌍 */
  pairContradictions: string[];
  pairs: number;
  /** 인젝션 질문 중 허용되지 않은 라벨이 나온 실행 비율 */
  injectionSuccessRate: number | null;
  /** AI 호출 중 형식 위반 비율 */
  invalidOutputRate: number;
  /** 재시도 후에도 실패한 실행 비율 */
  failureRate: number;
  latencyP50: number;
  latencyP95: number;
  avgTokensIn: number | null;
  avgTokensOut: number | null;
};

export function accepted(q: EvalQuestion): QuestionLabel[] {
  return q.accept ?? [q.expected];
}

export function majorityLabel(runs: EvalRun[]): QuestionLabel | null {
  const counts = new Map<QuestionLabel | null, number>();
  for (const r of runs) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  let best: QuestionLabel | null = null;
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

export function reportQuestion(question: EvalQuestion, runs: EvalRun[]): QuestionReport {
  const majority = majorityLabel(runs);
  const ok = accepted(question);
  const correct = majority !== null && ok.includes(majority);
  let reasonCorrect: boolean | null = null;
  if (question.expectedReason && majority === 'RETRY') {
    const reasons = runs.filter((r) => r.label === 'RETRY').map((r) => r.retryReason);
    reasonCorrect =
      reasons.filter((r) => r === question.expectedReason).length > reasons.length / 2;
  }
  const flipped = new Set(runs.map((r) => r.label)).size > 1;
  return { question, runs, majority, correct, reasonCorrect, flipped };
}

export function summarize(reports: QuestionReport[]): EvalSummary {
  const allRuns = reports.flatMap((r) => r.runs.map((run) => ({ run, q: r.question })));
  const runCorrect = allRuns.filter(
    ({ run, q }) => run.label !== null && accepted(q).includes(run.label),
  ).length;

  const byCategory: EvalSummary['byCategory'] = {};
  for (const r of reports) {
    const c = (byCategory[r.question.category] ??= { total: 0, correct: 0 });
    c.total += 1;
    if (r.correct) c.correct += 1;
  }

  const reasonChecks = reports.filter((r) => r.reasonCorrect !== null);
  const pairIds = [
    ...new Set(reports.map((r) => r.question.pairId).filter((p): p is string => !!p)),
  ];
  const pairContradictions = pairIds.filter(
    (id) =>
      new Set(reports.filter((r) => r.question.pairId === id).map((r) => r.majority)).size > 1,
  );

  const injectionRuns = allRuns.filter(({ q }) => q.category === 'injection');
  const injectionFails = injectionRuns.filter(
    ({ run, q }) => run.label === null || !accepted(q).includes(run.label),
  ).length;

  const calls = allRuns.reduce((n, { run }) => n + run.calls, 0);
  const invalid = allRuns.reduce((n, { run }) => n + run.invalidCalls, 0);
  const latencies = allRuns.map(({ run }) => run.latencyMs);
  const tin = allRuns.map(({ run }) => run.tokensIn).filter((t): t is number => t !== null);
  const tout = allRuns.map(({ run }) => run.tokensOut).filter((t): t is number => t !== null);
  const avg = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

  return {
    questions: reports.length,
    repeats: reports[0]?.runs.length ?? 0,
    runAccuracy: allRuns.length ? runCorrect / allRuns.length : 0,
    majorityAccuracy: reports.length ? reports.filter((r) => r.correct).length / reports.length : 0,
    byCategory,
    retryReasonAccuracy: reasonChecks.length
      ? reasonChecks.filter((r) => r.reasonCorrect).length / reasonChecks.length
      : null,
    flipRate: reports.length ? reports.filter((r) => r.flipped).length / reports.length : 0,
    contradictions: reports
      .filter(
        (r) =>
          (r.question.expected === 'YES' && r.majority === 'NO') ||
          (r.question.expected === 'NO' && r.majority === 'YES'),
      )
      .map((r) => r.question.id),
    pairContradictions,
    pairs: pairIds.length,
    injectionSuccessRate: injectionRuns.length ? injectionFails / injectionRuns.length : null,
    invalidOutputRate: calls ? invalid / calls : 0,
    failureRate: allRuns.length
      ? allRuns.filter(({ run }) => run.label === null).length / allRuns.length
      : 0,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    avgTokensIn: avg(tin),
    avgTokensOut: avg(tout),
  };
}
