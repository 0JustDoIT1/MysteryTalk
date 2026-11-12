import type { PrismaClient } from '../generated/prisma/client.js';
import { monthKey } from './keys.js';

export type CaseStats = {
  slug: string;
  title: string;
  started: number;
  finished: number;
  /** 끝난 세션 중 해결 비율 */
  solveRate: number | null;
  /** 해결한 세션의 평균 질문 수 */
  avgQuestionsSolved: number | null;
  /** 끝난 세션 중 힌트를 1개 이상 연 비율 */
  hintRate: number | null;
  /** 전체 질문 기록 중 '다시 질문' 비율 */
  retryRate: number | null;
};

export type Stats = {
  cases: CaseStats[];
  budget: { month: string; limitKrw: number; spentKrw: number } | null;
};

const ratio = (n: number, d: number) => (d ? n / d : null);

/**
 * 플레이 통계(PRD D47): 사건 단위 비식별 지표만 집계한다. 플레이어·IP·질문 원문은 결과에 넣지 않는다.
 * 실행: `npm run stats -w backend`
 */
export async function collectStats(prisma: PrismaClient, now = new Date()): Promise<Stats> {
  const cases = await prisma.mysteryCase.findMany({
    orderBy: [{ isTutorial: 'desc' }, { slug: 'asc' }],
    select: { id: true, slug: true, title: true },
  });
  const out: CaseStats[] = [];
  for (const c of cases) {
    const sessions = await prisma.playSession.findMany({
      where: { caseId: c.id },
      select: {
        status: true,
        questionsUsed: true,
        _count: { select: { hintViews: true } },
      },
    });
    const finished = sessions.filter((s) => s.status !== 'ACTIVE');
    const solved = finished.filter((s) => s.status === 'SOLVED');
    const [total, retry] = await Promise.all([
      prisma.questionLog.count({ where: { session: { caseId: c.id } } }),
      prisma.questionLog.count({ where: { session: { caseId: c.id }, label: 'RETRY' } }),
    ]);
    out.push({
      slug: c.slug,
      title: c.title,
      started: sessions.length,
      finished: finished.length,
      solveRate: ratio(solved.length, finished.length),
      avgQuestionsSolved: ratio(
        solved.reduce((n, s) => n + s.questionsUsed, 0),
        solved.length,
      ),
      hintRate: ratio(finished.filter((s) => s._count.hintViews > 0).length, finished.length),
      retryRate: ratio(retry, total),
    });
  }
  const month = await prisma.budgetMonth.findUnique({ where: { month: monthKey(now) } });
  return {
    cases: out,
    budget: month
      ? {
          month: month.month,
          limitKrw: month.limitKrw,
          spentKrw: Number(month.spentJudgeKrw) + Number(month.spentGradeKrw),
        }
      : null,
  };
}
