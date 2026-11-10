import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ScriptedGrader } from '../src/grade/mock.grader.js';
import { ScriptedJudge } from '../src/judge/mock.judge.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  cookiePair,
  createTestApp,
  findSetCookie,
  loadSample,
  loadTutorial,
  resetDb,
} from './helpers.js';

const SAMPLE = 'sample-blackout-302'; // B=20 → 힌트 해금 7, 14, 20
const TUTORIAL = 'tutorial-missing-key'; // B=15

// 정답 요소 키워드와 맞는 답안(키워드 판정 통과). AI 판정은 ScriptedGrader로 정한다.
const FULL = '조카 문태성이 돈 문제로 다투다 한정숙을 밀쳐 죽게 하고 차단기를 내려 사고로 꾸몄다.';
const CULPRIT_ONLY = '조카 문태성이 한정숙을 독으로 죽인 것 같아요.';
const NOTHING = '관리인이 범인이고 독을 썼다고 생각합니다.';
const MATCH_ALL = { A1: 'MATCH', A2: 'MATCH', A3: 'MATCH', A4: 'MATCH' } as const;

// 실제 PostgreSQL 테스트 DB 필요. AI는 ScriptedJudge·ScriptedGrader.
describe('3단계 제출·채점·점수·힌트·엔딩 (e2e, SPEC §7·§8·§9.1)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const judge = new ScriptedJudge();
  const grader = new ScriptedGrader();
  const http = () => request(app.getHttpServer());

  async function newPlayer(): Promise<string> {
    const res = await http().get('/me').expect(200);
    return cookiePair(findSetCookie(res, 'mt_guest'));
  }

  async function start(cookie: string, slug = SAMPLE): Promise<string> {
    const res = await http().post(`/cases/${slug}/sessions`).set('Cookie', cookie).expect(201);
    return res.body.sessionId as string;
  }

  function submit(cookie: string, id: string, answer: string, key: string = randomUUID()) {
    return http()
      .post(`/sessions/${id}/submissions`)
      .set('Cookie', cookie)
      .set('Idempotency-Key', key)
      .send({ answer });
  }

  /** 서로 다른 질문 n개(ScriptedJudge 기본값 IRRELEVANT → 모두 차감) */
  async function askMany(cookie: string, id: string, n: number, from = 0): Promise<void> {
    for (let i = from; i < from + n; i += 1) {
      await http()
        .post(`/sessions/${id}/questions`)
        .set('Cookie', cookie)
        .set('Idempotency-Key', randomUUID())
        .send({ question: `연습 질문 ${i}번인가요?` })
        .expect(200);
    }
  }

  const state = async (cookie: string, id: string) =>
    (await http().get(`/sessions/${id}`).set('Cookie', cookie).expect(200)).body;
  const hint = (cookie: string, id: string, no: number) =>
    http().post(`/sessions/${id}/hints/${no}`).set('Cookie', cookie);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ judge, grader }));
  });

  beforeEach(async () => {
    judge.reset();
    grader.reset();
    await resetDb(prisma);
    await loadTutorial(prisma);
    await loadSample(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('힌트 (SPEC §9.1, PRD D15·D17)', () => {
    it('질문 수가 해금 시점(⌈B/3⌉)에 닿기 전에는 열 수 없다', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      await askMany(cookie, id, 6);
      expect((await hint(cookie, id, 1).expect(409)).body.code).toBe('HINT_LOCKED');
      await askMany(cookie, id, 1, 6);
      const res = await hint(cookie, id, 1).expect(200);
      expect(res.body).toMatchObject({ no: 1, unlockAt: 7, unlocked: true, viewed: true });
      expect(res.body.text).toContain('정전');
    });

    it('순서대로만 열 수 있고, 같은 힌트를 다시 열어도 감점은 1회', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      await askMany(cookie, id, 14);
      expect((await hint(cookie, id, 2).expect(409)).body.code).toBe('HINT_LOCKED');
      await hint(cookie, id, 1).expect(200);
      await Promise.all([hint(cookie, id, 1), hint(cookie, id, 1)]);
      await hint(cookie, id, 2).expect(200);
      expect(await prisma.hintView.count({ where: { sessionId: id } })).toBe(2);
      const s = await state(cookie, id);
      expect(s.hints.map((h: { viewed: boolean }) => h.viewed)).toEqual([true, true, false]);
      // 열지 않은 힌트 본문은 응답에 없다
      expect(s.hints[2]).toMatchObject({ unlocked: false, text: null });
    });

    it('없는 힌트 번호는 422, 남의 세션은 404', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      await hint(cookie, id, 4).expect(422);
      await hint(await newPlayer(), id, 1).expect(404);
    });
  });

  describe('정답 제출 (SPEC §7)', () => {
    it('입력 10~300자, 멱등성 키 필수', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      expect((await submit(cookie, id, '가'.repeat(9)).expect(422)).body.code).toBe(
        'INVALID_INPUT',
      );
      await submit(cookie, id, '가'.repeat(301)).expect(422);
      const res = await http()
        .post(`/sessions/${id}/submissions`)
        .set('Cookie', cookie)
        .send({ answer: FULL })
        .expect(400);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      expect(grader.received).toHaveLength(0);
    });

    it('오답은 기회 1회 차감 + 확정 일치한 필수 요소 개수만 알려 준다(D21, D84)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      grader.set(CULPRIT_ONLY, { A1: 'MATCH' });
      const res = await submit(cookie, id, CULPRIT_ONLY).expect(200);
      expect(res.body).toEqual({
        result: 'WRONG',
        detailReason: null,
        matchedCount: 1,
        totalCount: 3,
        submissionsLeft: 2,
        status: 'ACTIVE',
      });
      // 오답 후에도 질문 가능(D22)
      await askMany(cookie, id, 1);
      expect((await state(cookie, id)).submissionsLeft).toBe(2);
    });

    it('채점 미확정은 재작성 요청(미차감·개수 없음), 2회를 넘으면 AI 판정으로 확정한다(D23)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      // 키워드는 모두 맞지만 AI가 A3을 불일치로 봄 → A3 미확정
      grader.set(FULL, { ...MATCH_ALL, A3: 'NO_MATCH' });
      for (let i = 0; i < 2; i += 1) {
        const r = await submit(cookie, id, FULL).expect(200);
        expect(r.body).toEqual({
          result: 'NEEDS_DETAIL',
          detailReason: 'DETAIL',
          matchedCount: null,
          totalCount: null,
          submissionsLeft: 3,
          status: 'ACTIVE',
        });
      }
      const third = await submit(cookie, id, FULL).expect(200);
      expect(third.body).toMatchObject({ result: 'WRONG', matchedCount: 2, submissionsLeft: 2 });
      // 앞 두 번은 일반 판정, 세 번째는 마지막 판정(AI는 MATCH/NO_MATCH만)
      expect(grader.received.map((r) => r.final)).toEqual([false, false, true]);
    });

    it('마지막 판정에서 AI가 일치로 보면 키워드와 엇갈려도 해결된다(D23)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      // 이름만 쓴 답안: A1 키워드(문태성·조카·태성)는 맞지만 AI가 A2를 애매하게 봄 → 재작성 요청
      const vague = '조카 문태성이 이모와 다투다 무슨 일이 있었고 차단기를 내려 사고로 꾸몄다.';
      grader.set(vague, { ...MATCH_ALL, A2: 'UNCLEAR' });
      await submit(cookie, id, vague).expect(200);
      await submit(cookie, id, vague).expect(200);
      // 마지막 판정에서 ScriptedGrader는 UNCLEAR를 낼 수 없어 NO_MATCH가 된다 → 오답
      const last = await submit(cookie, id, vague).expect(200);
      expect(last.body).toMatchObject({ result: 'WRONG', matchedCount: 2, totalCount: 3 });

      const id2 = await (async () => {
        await http().post(`/sessions/${id}/abandon`).set('Cookie', cookie).expect(200);
        return start(cookie);
      })();
      // 키워드 '밀쳐'가 없지만 AI가 일치로 보는 답안 → 두 번 재작성 요청 뒤 마지막 판정에서 해결
      const synonym =
        '조카 문태성이 이모를 떠미는 바람에 피아노에 부딪혔고 차단기를 내려 사고로 꾸몄다.';
      grader.set(synonym, MATCH_ALL);
      for (let i = 0; i < 2; i += 1) {
        expect((await submit(cookie, id2, synonym).expect(200)).body.result).toBe('NEEDS_DETAIL');
      }
      expect((await submit(cookie, id2, synonym).expect(200)).body).toMatchObject({
        result: 'SOLVED',
        status: 'SOLVED',
      });
    });

    it('단어 나열·여러 가능성 나열은 형식 사유로 재작성 요청, 마지막 판정에서는 오답', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      const list = '문태성 밀쳐 차단기 돈 조카 정전';
      grader.set(list, MATCH_ALL, 'KEYWORD_LIST');
      const first = await submit(cookie, id, list).expect(200);
      expect(first.body).toMatchObject({ result: 'NEEDS_DETAIL', detailReason: 'FORM' });
      await submit(cookie, id, list).expect(200);
      const last = await submit(cookie, id, list).expect(200);
      expect(last.body).toMatchObject({ result: 'WRONG', matchedCount: 0, detailReason: null });
    });

    it('채점 AI 실패는 미차감·기록 없음, 같은 키로 재시도하면 한 번만 처리된다(D73)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      const key = randomUUID();
      grader.set(CULPRIT_ONLY, 'fail');
      expect((await submit(cookie, id, CULPRIT_ONLY, key).expect(503)).body.code).toBe(
        'AI_UNAVAILABLE',
      );
      expect(await prisma.submission.count()).toBe(0);
      expect((await state(cookie, id)).submissionsLeft).toBe(3);
      grader.set(CULPRIT_ONLY, { A1: 'MATCH' });
      const first = await submit(cookie, id, CULPRIT_ONLY, key).expect(200);
      const replay = await submit(cookie, id, CULPRIT_ONLY, key).expect(200);
      expect(replay.body).toEqual(first.body);
      expect(grader.received).toHaveLength(2);
      expect((await submit(cookie, id, FULL, key).expect(422)).body.code).toBe(
        'IDEMPOTENCY_MISMATCH',
      );
      expect((await state(cookie, id)).submissionsLeft).toBe(2);
    });

    it('질문 상한(3B)에 닿아도 제출은 할 수 있다', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      await prisma.playSession.update({ where: { id }, data: { questionsUsed: 60 } });
      grader.set(FULL, MATCH_ALL);
      await submit(cookie, id, FULL).expect(200);
    });
  });

  describe('해결·점수·엔딩·기록 (SPEC §8, PRD D18·D61)', () => {
    it('해결하면 점수·등급을 계산하고, 엔딩에 내역·요소별 충족·해설을 공개한다', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      expect(
        (await http().get(`/sessions/${id}/ending`).set('Cookie', cookie).expect(409)).body.code,
      ).toBe('SESSION_NOT_FINISHED');
      await askMany(cookie, id, 22); // 기준 20 초과 2개 → -4
      await hint(cookie, id, 1).expect(200); // -10
      grader.set(CULPRIT_ONLY, { A1: 'MATCH' });
      await submit(cookie, id, CULPRIT_ONLY).expect(200); // 오답 -10
      grader.set(FULL, { ...MATCH_ALL, A4: 'NO_MATCH' });
      const res = await submit(cookie, id, FULL).expect(200);
      expect(res.body).toMatchObject({ result: 'SOLVED', status: 'SOLVED', submissionsLeft: 2 });

      const ending = (await http().get(`/sessions/${id}/ending`).set('Cookie', cookie).expect(200))
        .body;
      expect(ending).toMatchObject({
        status: 'SOLVED',
        score: 76,
        grade: 'B',
        recorded: true,
        playNo: 1,
        breakdown: { questionPenalty: 4, hintPenalty: 10, wrongPenalty: 10 },
      });
      expect(ending.elements.map((e: { matched: boolean }) => e.matched)).toEqual([
        true,
        true,
        true,
        false,
      ]);
      expect(ending.explanation).toContain('차단기');

      const list = (await http().get('/cases').set('Cookie', cookie).expect(200)).body;
      expect(list.find((c: { slug: string }) => c.slug === SAMPLE)).toMatchObject({
        activeSessionId: null,
        record: { bestGrade: 'B', bestPlayNo: 1, totalPlays: 1, solved: true },
      });
    });

    it('종료 후에는 질문·제출·힌트를 받지 않는다', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      grader.set(FULL, MATCH_ALL);
      await submit(cookie, id, FULL).expect(200);
      const q = await http()
        .post(`/sessions/${id}/questions`)
        .set('Cookie', cookie)
        .set('Idempotency-Key', randomUUID())
        .send({ question: '아직 질문할 수 있나요?' })
        .expect(409);
      expect(q.body.code).toBe('SESSION_FINISHED');
      expect((await submit(cookie, id, FULL).expect(409)).body.code).toBe('SESSION_FINISHED');
      expect((await hint(cookie, id, 1).expect(409)).body.code).toBe('SESSION_FINISHED');
    });

    it('3번 틀리면 종료: 마지막 제출이 필수 요소 절반 이상이면 D, 미만이면 F (D69)', async () => {
      const cookie = await newPlayer();
      const partial = await start(cookie);
      grader.set(NOTHING, {});
      grader.set(CULPRIT_ONLY, { A1: 'MATCH' });
      // 문태성 + 밀쳐 → 필수 3개 중 2개
      const twoOfThree = '조카 문태성이 한정숙을 밀쳐서 죽였다고 봅니다.';
      grader.set(twoOfThree, { A1: 'MATCH', A2: 'MATCH' });
      await submit(cookie, partial, NOTHING).expect(200);
      await submit(cookie, partial, CULPRIT_ONLY).expect(200);
      const last = await submit(cookie, partial, twoOfThree).expect(200);
      expect(last.body).toMatchObject({ result: 'WRONG', status: 'PARTIAL', submissionsLeft: 0 });
      const ending = (
        await http().get(`/sessions/${partial}/ending`).set('Cookie', cookie).expect(200)
      ).body;
      expect(ending).toMatchObject({ grade: 'D', score: null });

      const failed = await start(cookie);
      for (const a of [twoOfThree, CULPRIT_ONLY, NOTHING]) await submit(cookie, failed, a);
      expect((await state(cookie, failed)).status).toBe('FAILED');
    });

    it('재플레이: 새 회차로 시작하고 최고 등급과 달성 회차를 갱신한다(D18)', async () => {
      const cookie = await newPlayer();
      const first = await start(cookie);
      await http().post(`/sessions/${first}/abandon`).set('Cookie', cookie).expect(200);
      const second = await start(cookie);
      expect((await state(cookie, second)).playNo).toBe(2);
      grader.set(FULL, MATCH_ALL);
      await submit(cookie, second, FULL).expect(200);
      const third = await start(cookie);
      await http().post(`/sessions/${third}/abandon`).set('Cookie', cookie).expect(200);
      const record = (await http().get('/cases').set('Cookie', cookie).expect(200)).body.find(
        (c: { slug: string }) => c.slug === SAMPLE,
      ).record;
      expect(record).toEqual({ bestGrade: 'S', bestPlayNo: 2, totalPlays: 3, solved: true });
    });

    it('튜토리얼은 점수·등급을 보여 주되 개인 기록에는 남기지 않는다(PRD v1.3)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie, TUTORIAL);
      const answer =
        '제빵사 강민호가 앞치마 주머니에 열쇠를 넣고 세탁 자루에 넣었다. 도난이 아니다.';
      grader.set(answer, { A1: 'MATCH', A2: 'MATCH' });
      await submit(cookie, id, answer).expect(200);
      const ending = (await http().get(`/sessions/${id}/ending`).set('Cookie', cookie).expect(200))
        .body;
      expect(ending).toMatchObject({ isTutorial: true, recorded: false, grade: 'S', score: 100 });
      expect(await prisma.caseRecord.count()).toBe(0);
    });
  });

  describe('포기·메모 (PRD D80, D62)', () => {
    it('포기하면 F와 해설 공개, 다시 포기해도 성공, 남의 세션은 404', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      await http()
        .post(`/sessions/${id}/abandon`)
        .set('Cookie', await newPlayer())
        .expect(404);
      await http().post(`/sessions/${id}/abandon`).set('Cookie', cookie).expect(200);
      await http().post(`/sessions/${id}/abandon`).set('Cookie', cookie).expect(200);
      const ending = (await http().get(`/sessions/${id}/ending`).set('Cookie', cookie).expect(200))
        .body;
      expect(ending).toMatchObject({ status: 'ABANDONED', grade: 'F', score: null });
      expect(await prisma.caseRecord.count()).toBe(1);
    });

    it('판정 중에 포기하면 늦게 도착한 판정 결과는 버린다(차감 없음)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      judge.setDelay(300);
      const pending = http()
        .post(`/sessions/${id}/questions`)
        .set('Cookie', cookie)
        .set('Idempotency-Key', randomUUID())
        .send({ question: '포기 직전의 질문인가요?' });
      const [q] = await Promise.all([
        pending,
        new Promise((r) => setTimeout(r, 100)).then(() =>
          http().post(`/sessions/${id}/abandon`).set('Cookie', cookie),
        ),
      ]);
      expect(q.status).toBe(409);
      expect(q.body.code).toBe('SESSION_FINISHED');
      const row = await prisma.playSession.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: 'ABANDONED', questionsUsed: 0 });
      expect(await prisma.questionLog.count()).toBe(0);
    });

    it('메모를 저장하고 진행 상태로 복원한다(AI에는 전달하지 않음)', async () => {
      const cookie = await newPlayer();
      const id = await start(cookie);
      await http()
        .put(`/sessions/${id}/memo`)
        .set('Cookie', cookie)
        .send({ memo: '손전등이 꺼져 있었다' })
        .expect(200);
      expect((await state(cookie, id)).memo).toBe('손전등이 꺼져 있었다');
      await askMany(cookie, id, 1);
      expect(JSON.stringify(judge.received)).not.toContain('손전등이 꺼져');
      await http()
        .put(`/sessions/${id}/memo`)
        .set('Cookie', cookie)
        .send({ memo: '가'.repeat(2001) })
        .expect(422);
    });
  });
});
