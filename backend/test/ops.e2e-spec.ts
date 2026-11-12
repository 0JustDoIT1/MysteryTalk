import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { ScriptedGrader } from '../src/grade/mock.grader.js';
import { ScriptedJudge } from '../src/judge/mock.judge.js';

// 한도를 작게 바꿔 띄운다. 환경 변수는 앱 모듈을 불러올 때 읽히므로 먼저 바꾸고 나중에 불러온다.
const OVERRIDES: Record<string, string> = {
  DAILY_LIMIT_GUEST: '3',
  DAILY_LIMIT_USER: '5',
  DAILY_LIMIT_TUTORIAL: '2',
  MONTHLY_AI_BUDGET_KRW: '5000',
  BUDGET_RESERVE_RATIO: '0.1',
};

const SAMPLE = 'sample-blackout-302';
const TUTORIAL = 'tutorial-missing-key';
const FULL = '조카 문태성이 돈 문제로 다투다 한정숙을 밀쳐 죽게 하고 차단기를 내려 사고로 꾸몄다.';

// 실제 PostgreSQL 테스트 DB 필요.
describe('7단계 운영: 일일 한도·월 예산·공지·정리·통계 (e2e, SPEC §10, PRD D41·D46·D47·D58·D72·D83)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const saved: Record<string, string | undefined> = {};
  const grader = new ScriptedGrader();
  let h: typeof import('./helpers.js');
  const http = () => request(app.getHttpServer());

  async function guest(ip = '10.0.0.1'): Promise<{ cookie: string; ip: string }> {
    const res = await http().get('/me').set('X-Forwarded-For', ip).expect(200);
    return { cookie: h.cookiePair(h.findSetCookie(res, 'mt_guest')), ip };
  }
  async function start(who: { cookie: string; ip: string }, slug = SAMPLE): Promise<string> {
    const res = await http()
      .post(`/cases/${slug}/sessions`)
      .set('Cookie', who.cookie)
      .set('X-Forwarded-For', who.ip)
      .expect(201);
    return res.body.sessionId as string;
  }
  function ask(who: { cookie: string; ip: string }, id: string, question: string) {
    return http()
      .post(`/sessions/${id}/questions`)
      .set('Cookie', who.cookie)
      .set('X-Forwarded-For', who.ip)
      .set('Idempotency-Key', randomUUID())
      .send({ question });
  }
  function submit(who: { cookie: string; ip: string }, id: string) {
    return http()
      .post(`/sessions/${id}/submissions`)
      .set('Cookie', who.cookie)
      .set('X-Forwarded-For', who.ip)
      .set('Idempotency-Key', randomUUID())
      .send({ answer: FULL });
  }

  beforeAll(async () => {
    for (const [k, v] of Object.entries(OVERRIDES)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    h = await import('./helpers.js');
    ({ app, prisma } = await h.createTestApp({ judge: new ScriptedJudge(), grader }));
  });

  beforeEach(async () => {
    grader.reset();
    await h.resetDb(prisma);
    await h.loadTutorial(prisma);
    await h.loadSample(prisma);
  });

  afterAll(async () => {
    await app.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  describe('일일 질문 한도 (D58·D83)', () => {
    it('게스트는 IP당 한도까지만 AI 질문을 받고, AI를 쓰지 않는 질문과 정답 제출은 막지 않는다', async () => {
      const g = await guest();
      const id = await start(g);
      for (const q of ['첫 번째 질문인가요?', '두 번째 질문인가요?', '세 번째 질문인가요?']) {
        await ask(g, id, q).expect(200);
      }
      expect((await ask(g, id, '네 번째 질문인가요?').expect(429)).body.code).toBe(
        'DAILY_LIMIT_REACHED',
      );
      // 같은 문장 재질문·욕설(사전 필터)은 AI를 쓰지 않으므로 통과
      await ask(g, id, '첫 번째 질문인가요?').expect(200);
      expect((await ask(g, id, '씨발 범인 누구야').expect(200)).body.label).toBe('RETRY');
      // 정답 제출은 일일 한도와 무관
      await submit(g, id).expect(200);
    });

    it('다른 IP는 따로 세고, 같은 IP의 다른 게스트는 함께 센다', async () => {
      const a = await guest('10.0.0.1');
      const b = await guest('10.0.0.1');
      const c = await guest('10.0.0.2');
      const ida = await start(a);
      for (const q of ['가 질문 하나인가요?', '가 질문 둘인가요?', '가 질문 셋인가요?']) {
        await ask(a, ida, q).expect(200);
      }
      await ask(b, await start(b), '같은 IP 다른 게스트인가요?').expect(429);
      await ask(c, await start(c), '다른 IP 게스트인가요?').expect(200);
    });

    it('튜토리얼은 IP 한도에서 빼고 따로 센다', async () => {
      const g = await guest();
      const id = await start(g);
      for (const q of ['본편 질문 하나인가요?', '본편 질문 둘인가요?', '본편 질문 셋인가요?']) {
        await ask(g, id, q).expect(200);
      }
      const t = await start(g, TUTORIAL);
      await ask(g, t, '튜토리얼 질문 하나인가요?').expect(200);
      await ask(g, t, '튜토리얼 질문 둘인가요?').expect(200);
      expect((await ask(g, t, '튜토리얼 질문 셋인가요?').expect(429)).body.code).toBe(
        'DAILY_LIMIT_REACHED',
      );
    });

    it('IP는 원문 대신 해시로만 저장한다', async () => {
      const g = await guest('203.0.113.9');
      await ask(g, await start(g), '저장 형식 확인 질문인가요?').expect(200);
      const rows = await prisma.usageDaily.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ subjectType: 'IP', questions: 1 });
      expect(rows[0]!.subjectHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(rows)).not.toContain('203.0.113.9');
    });
  });

  describe('월 AI 예산 (D46·D72)', () => {
    const month = () => {
      const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      return kst.toISOString().slice(0, 7);
    };

    it('질문 예산(한도 − 예비)을 다 쓰면 새 질문은 막고, 정답 제출은 예비 예산으로 받는다', async () => {
      await prisma.budgetMonth.create({
        data: { month: month(), limitKrw: 5000, reserveKrw: 500, spentJudgeKrw: 4500 },
      });
      const g = await guest();
      const id = await start(g);
      expect((await ask(g, id, '예산이 남았나요?').expect(429)).body.code).toBe(
        'MONTHLY_BUDGET_REACHED',
      );
      await submit(g, id).expect(200);
    });

    it('예비 예산까지 다 쓰면 정답 제출도 막는다', async () => {
      await prisma.budgetMonth.create({
        data: { month: month(), limitKrw: 5000, reserveKrw: 500, spentGradeKrw: 5000 },
      });
      const g = await guest();
      const id = await start(g);
      expect((await submit(g, id).expect(429)).body.code).toBe('MONTHLY_BUDGET_REACHED');
    });
  });

  it('공지 목록을 최신순으로 돌려준다(D41)', async () => {
    const res = await http().get('/notices').expect(200);
    expect(res.body[0]).toMatchObject({ id: '2026-11-12-welcome', date: '2026-11-12' });
    expect(res.body[0].body).toContain('개발 중');
  });

  it('정리: 30일 지난 게스트·이전 끝난 게스트·만료 세션만 지우고, 미리 보기는 지우지 않는다(D32)', async () => {
    const { cleanup } = await import('../src/ops/cleanup.js');
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const stale = await prisma.player.create({
      data: { kind: 'GUEST', detectiveName: '탐정', lastActiveAt: old },
    });
    const recent = await prisma.player.create({ data: { kind: 'GUEST', detectiveName: '탐정' } });
    const user = await prisma.player.create({
      data: { kind: 'USER', googleSub: 'fake|old-user', detectiveName: '탐정', lastActiveAt: old },
    });
    await prisma.player.create({
      data: { kind: 'GUEST', detectiveName: '탐정', mergedIntoId: user.id },
    });
    await prisma.authSession.create({
      data: { playerId: user.id, tokenHash: 'x'.repeat(64), expiresAt: old },
    });

    expect(await cleanup(prisma, { dryRun: true })).toEqual({
      guests: 1,
      mergedGuests: 1,
      expiredSessions: 1,
      usageRows: 0,
    });
    expect(await prisma.player.count()).toBe(4);

    await cleanup(prisma);
    const left = (await prisma.player.findMany({ select: { id: true } })).map((p) => p.id).sort();
    expect(left).toEqual([recent.id, user.id].sort());
    expect(await prisma.player.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await prisma.authSession.count()).toBe(0);
  });

  it('통계는 사건 단위 비식별 지표만 낸다(D47)', async () => {
    const { collectStats } = await import('../src/ops/stats.js');
    grader.set(FULL, { A1: 'MATCH', A2: 'MATCH', A3: 'MATCH', A4: 'MATCH' });
    const g = await guest();
    const id = await start(g);
    await ask(g, id, '통계용 질문인가요?').expect(200);
    await submit(g, id).expect(200);
    const stats = await collectStats(prisma);
    expect(stats.cases.find((c) => c.slug === SAMPLE)).toMatchObject({
      started: 1,
      finished: 1,
      solveRate: 1,
      avgQuestionsSolved: 1,
      hintRate: 0,
      retryRate: 0,
    });
    const text = JSON.stringify(stats);
    expect(text).not.toContain(id);
    expect(text).not.toContain('통계용 질문');
  });
});
