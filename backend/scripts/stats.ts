import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { collectStats } from '../src/ops/stats.js';

/** 비식별 플레이 통계(PRD D47): `npm run stats -w backend` */
const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const pct = (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(1)}%`);
try {
  const s = await collectStats(prisma);
  console.log('사건 | 시작 | 종료 | 해결률 | 해결 평균 질문 | 힌트 사용률 | 다시 질문 비율');
  for (const c of s.cases) {
    console.log(
      `${c.slug} | ${c.started} | ${c.finished} | ${pct(c.solveRate)} | ${c.avgQuestionsSolved?.toFixed(1) ?? '-'} | ${pct(c.hintRate)} | ${pct(c.retryRate)}`,
    );
  }
  console.log(
    s.budget
      ? `이번 달(${s.budget.month}) AI 비용 ${s.budget.spentKrw.toFixed(2)}원 / 한도 ${s.budget.limitKrw}원`
      : '이번 달 AI 비용 기록 없음',
  );
} finally {
  await prisma.$disconnect();
}
