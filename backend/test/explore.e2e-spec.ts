import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ScriptedGrader } from '../src/grade/mock.grader.js';
import { ScriptedJudge } from '../src/judge/mock.judge.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { cookiePair, createTestApp, findSetCookie, loadSample, resetDb } from './helpers.js';

const SAMPLE = 'sample-blackout-302';
// 샘플 맵: 거실(시작 6,6)·현관·복도는 처음부터 열림
//   → 빌라 관리실: 현관의 '내려진 차단기' 단서로 열림(단서 해금)
//   → 302호 안방: 돈 문제(F10) '예' 판정 + 키워드, 또는 힌트 3으로 열림(사실 해금)

// 실제 PostgreSQL 테스트 DB 필요. AI는 ScriptedJudge.
describe('4단계 현장 조사 (e2e, SPEC §9.2, PRD §6)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const judge = new ScriptedJudge();
  const http = () => request(app.getHttpServer());

  async function setup(): Promise<{ cookie: string; id: string }> {
    const me = await http().get('/me').expect(200);
    const cookie = cookiePair(findSetCookie(me, 'mt_guest'));
    const res = await http().post(`/cases/${SAMPLE}/sessions`).set('Cookie', cookie).expect(201);
    return { cookie, id: res.body.sessionId as string };
  }
  const explore = async (cookie: string, id: string) =>
    (await http().get(`/sessions/${id}/explore`).set('Cookie', cookie).expect(200)).body;
  const move = (cookie: string, id: string, map: string, x: number, y: number) =>
    http().post(`/sessions/${id}/move`).set('Cookie', cookie).send({ map, x, y });
  const inspect = (cookie: string, id: string, target: string, map: string, x: number, y: number) =>
    http().post(`/sessions/${id}/inspect`).set('Cookie', cookie).send({ target, map, x, y });
  /** 거실 시작점에서 출입구(6,8)를 지나 현관·복도(6,1)로 */
  async function goHall(cookie: string, id: string) {
    await move(cookie, id, 'living', 6, 8).expect(200);
    await move(cookie, id, 'hall', 6, 1).expect(200);
  }
  /** 현관·복도에서 두꺼비집 옆(2,1)으로 가 조사 → 빌라 관리실이 열린다 */
  async function openOffice(cookie: string, id: string) {
    await goHall(cookie, id);
    await move(cookie, id, 'hall', 2, 1).expect(200);
    return inspect(cookie, id, 'breaker', 'hall', 2, 1).expect(200);
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ judge, grader: new ScriptedGrader() }));
  });

  beforeEach(async () => {
    judge.reset();
    await resetDb(prisma);
    await loadSample(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('처음 상태: 시작 위치, 열린 맵만 내용 공개, 닫힌 맵은 이름만, 비공개 정보 없음', async () => {
    const { cookie, id } = await setup();
    const s = await explore(cookie, id);
    expect(s.position).toEqual({ map: 'living', x: 6, y: 6 });
    expect(s.maps.map((m: { key: string; unlocked: boolean }) => [m.key, m.unlocked])).toEqual([
      ['living', true],
      ['hall', true],
      ['office', false],
      ['bedroom', false],
    ]);
    expect(s.maps[2]).toMatchObject({ grid: null, exits: [], objects: [], npcs: [] });
    expect(s.maps[0].exits).toEqual([
      { x: 6, y: 8, to: 'hall', toX: 6, toY: 1, toName: '현관·복도', locked: false },
      { x: 0, y: 4, to: 'bedroom', toX: 6, toY: 3, toName: '302호 안방', locked: true },
    ]);
    expect(s.clues).toEqual([]);
    const text = JSON.stringify(s);
    for (const secret of ['description', 'decoy', '핏자국', '배터리', 'piano-blood', '"unlock":']) {
      expect(text).not.toContain(secret);
    }
  });

  it('이동: 벽·대상 칸·순간 이동은 거부하고, 저장한 위치를 복원한다', async () => {
    const { cookie, id } = await setup();
    expect((await move(cookie, id, 'living', 0, 0).expect(409)).body.code).toBe('INVALID_MOVE');
    await move(cookie, id, 'living', 2, 2).expect(409); // 피아노가 있는 칸
    await move(cookie, id, 'living', 1, 1).expect(409); // 시작 위치에서 10칸(허용 6칸 + 경과 시간)
    await move(cookie, id, 'living', 6, 3).expect(200);
    expect((await explore(cookie, id)).position).toEqual({ map: 'living', x: 6, y: 3 });
  });

  it('위치를 저장한 적이 없으면 세션 시작 시각을 기준으로 이동 거리를 검증한다(회귀)', async () => {
    const { cookie, id } = await setup();
    // 시작 1초 뒤: 허용 거리 6 + 1초 × 12칸 → 시작점에서 10칸 떨어진 스위치 옆까지 걸어갈 수 있다
    await prisma.playSession.update({
      where: { id },
      data: { startedAt: new Date(Date.now() - 1000) },
    });
    await inspect(cookie, id, 'switch', 'living', 11, 1).expect(200);
  });

  it('닫힌 구역은 출입구로도 들어갈 수 없고, 단서를 얻으면 열린다(D26)', async () => {
    const { cookie, id } = await setup();
    await goHall(cookie, id);
    await move(cookie, id, 'hall', 10, 3).expect(200);
    await move(cookie, id, 'hall', 12, 4).expect(200); // 관리실 출입구 칸
    expect((await move(cookie, id, 'office', 1, 1).expect(409)).body.code).toBe('ZONE_LOCKED');

    await move(cookie, id, 'hall', 8, 3).expect(200);
    await move(cookie, id, 'hall', 4, 2).expect(200);
    await move(cookie, id, 'hall', 2, 1).expect(200);
    const first = await inspect(cookie, id, 'breaker', 'hall', 2, 1).expect(200);
    expect(first.body).toMatchObject({
      kind: 'OBJECT',
      name: '두꺼비집',
      newClue: true,
      unlockedMaps: ['빌라 관리실'],
      clue: { key: 'breaker', title: '내려진 차단기' },
    });
    expect(first.body.clue).not.toHaveProperty('decoy');
    // 다시 조사: 같은 내용, 새 단서·해금 없음
    const again = await inspect(cookie, id, 'breaker', 'hall', 2, 1).expect(200);
    expect(again.body).toMatchObject({ newClue: false, unlockedMaps: [] });

    await move(cookie, id, 'hall', 7, 2).expect(200);
    await move(cookie, id, 'hall', 12, 3).expect(200);
    await move(cookie, id, 'hall', 12, 4).expect(200);
    await move(cookie, id, 'office', 1, 1).expect(200);
    const s = await explore(cookie, id);
    expect(s.position).toEqual({ map: 'office', x: 1, y: 1 });
    expect(s.maps[2]).toMatchObject({ key: 'office', unlocked: true });
    expect(s.clues.map((c: { key: string }) => c.key)).toEqual(['breaker']);
  });

  it('조사는 인접한 대상만, 다른 맵의 대상은 안 된다', async () => {
    const { cookie, id } = await setup();
    expect((await inspect(cookie, id, 'switch', 'living', 6, 6).expect(409)).body.code).toBe(
      'INVALID_MOVE',
    );
    await inspect(cookie, id, 'breaker', 'living', 6, 6).expect(404);
  });

  it('NPC 대화는 대사와 진술 단서를 준다(D75)', async () => {
    const { cookie, id } = await setup();
    await goHall(cookie, id);
    await move(cookie, id, 'hall', 9, 2).expect(200);
    const res = await inspect(cookie, id, 'seoyun', 'hall', 9, 2).expect(200);
    expect(res.body).toMatchObject({
      kind: 'NPC',
      name: '제자 배서윤',
      description: null,
      clue: { kind: 'TESTIMONY' },
      newClue: true,
    });
    expect(res.body.lines).toHaveLength(2);
  });

  describe('사실 해금 (D74)', () => {
    async function ask(cookie: string, id: string, question: string) {
      return http()
        .post(`/sessions/${id}/questions`)
        .set('Cookie', cookie)
        .set('Idempotency-Key', randomUUID())
        .send({ question })
        .expect(200);
    }

    it("'예' + 근거 사실 + 질문 키워드가 모두 맞을 때만 열고, 이유는 알려 주지 않는다", async () => {
      const { cookie, id } = await setup();
      judge.set('조카가 부탁을 하러 찾아왔나요?', {
        label: 'YES',
        retryReason: null,
        factIds: ['F10'],
      });
      judge.set('조카가 돈 때문에 왔을 수도 있나요?', {
        label: 'MAYBE',
        retryReason: null,
        factIds: ['F10'],
      });
      judge.set('조카가 돈을 빌리러 왔나요?', {
        label: 'YES',
        retryReason: null,
        factIds: ['F10'],
      });
      expect((await ask(cookie, id, '조카가 부탁을 하러 찾아왔나요?')).body.unlockedMaps).toEqual(
        [],
      );
      expect(
        (await ask(cookie, id, '조카가 돈 때문에 왔을 수도 있나요?')).body.unlockedMaps,
      ).toEqual([]);
      const res = await ask(cookie, id, '조카가 돈을 빌리러 왔나요?');
      expect(res.body.unlockedMaps).toEqual(['302호 안방']);
      expect(JSON.stringify(res.body)).not.toContain('F10');
      expect(await prisma.sessionZone.findMany({ where: { sessionId: id } })).toEqual([
        expect.objectContaining({ mapKey: 'bedroom', unlockedBy: 'FACT' }),
      ]);
    });

    it('연결된 힌트를 열어도 열린다(D26)', async () => {
      const { cookie, id } = await setup();
      await prisma.playSession.update({ where: { id }, data: { questionsUsed: 20 } });
      for (const no of [1, 2])
        await http().post(`/sessions/${id}/hints/${no}`).set('Cookie', cookie).expect(200);
      const res = await http().post(`/sessions/${id}/hints/3`).set('Cookie', cookie).expect(200);
      expect(res.body.unlockedMaps).toEqual(['302호 안방']);
      const again = await http().post(`/sessions/${id}/hints/3`).set('Cookie', cookie).expect(200);
      expect(again.body.unlockedMaps).toEqual([]);
    });
  });

  it('엔딩은 미끼 단서와 놓친 단서를 공개하고, 끝난 세션은 이동할 수 없다(D61)', async () => {
    const { cookie, id } = await setup();
    await openOffice(cookie, id);
    await http().post(`/sessions/${id}/abandon`).set('Cookie', cookie).expect(200);
    const ending = (await http().get(`/sessions/${id}/ending`).set('Cookie', cookie).expect(200))
      .body;
    expect(ending.clues).toHaveLength(10);
    expect(ending.clues).toContainEqual({
      title: '내려진 차단기',
      kind: 'ITEM',
      decoy: false,
      found: true,
    });
    expect(ending.clues).toContainEqual({
      title: '현관 매트의 흙 발자국',
      kind: 'ITEM',
      decoy: true,
      found: false,
    });
    expect((await move(cookie, id, 'hall', 3, 1).expect(409)).body.code).toBe('SESSION_FINISHED');
  });

  it('남의 세션은 404', async () => {
    const { id } = await setup();
    const { cookie: other } = await setup();
    await http().get(`/sessions/${id}/explore`).set('Cookie', other).expect(404);
    await move(other, id, 'living', 6, 5).expect(404);
  });
});
