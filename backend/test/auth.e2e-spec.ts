import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';
import { GoogleAuthProvider } from '../src/auth/auth-provider.js';
import { mergeGuestInto } from '../src/auth/merge.js';
import { ScriptedGrader } from '../src/grade/mock.grader.js';
import { ScriptedJudge } from '../src/judge/mock.judge.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, loadSample, loadTutorial, resetDb } from './helpers.js';

const SAMPLE = 'sample-blackout-302';
const FULL = '조카 문태성이 돈 문제로 다투다 한정숙을 밀쳐 죽게 하고 차단기를 내려 사고로 꾸몄다.';
const MATCH_ALL = { A1: 'MATCH', A2: 'MATCH', A3: 'MATCH', A4: 'MATCH' } as const;

/** Set-Cookie 들을 쿠키 상자에 반영한다(값이 비거나 만료면 지움). */
function absorb(jar: Map<string, string>, res: Response): void {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  for (const c of Array.isArray(raw) ? raw : raw ? [raw] : []) {
    const [pair] = c.split(';');
    const [name, ...rest] = pair!.split('=');
    const value = rest.join('=');
    if (!value || /Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(name!);
    else jar.set(name!, value);
  }
}
const header = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

// 실제 PostgreSQL 테스트 DB 필요. 로그인은 가짜 제공자(실제 구글 접속 없음).
describe('5단계 로그인·기록 이전 (e2e, SPEC §3, PRD D29~D33·D82)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const grader = new ScriptedGrader();
  const http = () => request(app.getHttpServer());

  /** 새 브라우저(게스트 쿠키 발급) */
  async function browser(): Promise<Map<string, string>> {
    const jar = new Map<string, string>();
    absorb(jar, await http().get('/me').expect(200));
    return jar;
  }

  /** 구글 로그인 흐름(가짜): 시작 → 콜백. 콜백의 결과(login=...)를 돌려준다. */
  async function login(jar: Map<string, string>, sub: string): Promise<string> {
    const start = await http().get(`/auth/google?fakeSub=${sub}`).set('Cookie', header(jar));
    expect(start.status).toBe(302);
    absorb(jar, start);
    const callback = new URL(start.headers['location'] as string);
    const done = await http()
      .get(`/auth/google/callback${callback.search}`)
      .set('Cookie', header(jar));
    expect(done.status).toBe(302);
    absorb(jar, done);
    return new URL(done.headers['location'] as string).searchParams.get('login')!;
  }

  const me = async (jar: Map<string, string>) => {
    const res = await http().get('/me').set('Cookie', header(jar)).expect(200);
    absorb(jar, res);
    return res.body as { kind: string; ageConfirmed: boolean; loginAvailable: boolean };
  };
  const start = async (jar: Map<string, string>, slug = SAMPLE) =>
    (await http().post(`/cases/${slug}/sessions`).set('Cookie', header(jar)).expect(201)).body
      .sessionId as string;
  const abandon = (jar: Map<string, string>, id: string) =>
    http().post(`/sessions/${id}/abandon`).set('Cookie', header(jar)).expect(200);
  const solve = (jar: Map<string, string>, id: string) =>
    http()
      .post(`/sessions/${id}/submissions`)
      .set('Cookie', header(jar))
      .set('Idempotency-Key', randomUUID())
      .send({ answer: FULL })
      .expect(200);
  const cases = async (jar: Map<string, string>) =>
    (await http().get('/cases').set('Cookie', header(jar)).expect(200)).body as {
      slug: string;
      activeSessionId: string | null;
      record: unknown;
    }[];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ judge: new ScriptedJudge(), grader }));
  });

  beforeEach(async () => {
    grader.reset();
    grader.set(FULL, MATCH_ALL);
    await resetDb(prisma);
    await loadTutorial(prisma);
    await loadSample(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('로그인하면 세션 쿠키를 받고 사용자로 식별되며, 게스트 쿠키는 지워진다', async () => {
    const jar = await browser();
    expect((await me(jar)).kind).toBe('GUEST');
    expect(await login(jar, 'alice')).toBe('ok');
    expect(jar.has('mt_session')).toBe(true);
    expect(jar.has('mt_guest')).toBe(false);
    expect(jar.has('mt_oauth')).toBe(false);
    expect(await me(jar)).toEqual({
      kind: 'USER',
      detectiveName: '탐정',
      ageConfirmed: false,
      loginAvailable: true,
    });
    const stored = await prisma.authSession.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(jar.get('mt_session')); // 원문 대신 해시 저장
  });

  it('state가 다르거나 진행 상태 쿠키가 없으면 로그인에 실패한다', async () => {
    const jar = await browser();
    const startRes = await http().get('/auth/google?fakeSub=bob').set('Cookie', header(jar));
    absorb(jar, startRes);
    const url = new URL(startRes.headers['location'] as string);
    url.searchParams.set('state', 'forged');
    const forged = await http()
      .get(`/auth/google/callback${url.search}`)
      .set('Cookie', header(jar));
    expect(forged.headers['location']).toContain('login=failed');
    const noFlow = await http().get('/auth/google/callback?code=fake:bob&state=x');
    expect(noFlow.headers['location']).toContain('login=failed');
    expect(await prisma.authSession.count()).toBe(0);
  });

  it('게스트 기록 이전: 진행 중 충돌은 최근 쪽만 남기고, 회차·기록을 시작 시각 순으로 다시 계산한다(D82)', async () => {
    // 계정(alice): 샘플 해결(S) → 샘플 진행 중
    const account = await browser();
    await login(account, 'alice');
    await solve(account, await start(account));
    const accountActive = await start(account);

    // 다른 브라우저의 게스트: 샘플 포기(F) → 샘플 진행 중(더 최근 활동) + 튜토리얼 진행 중
    const guest = await browser();
    await abandon(guest, await start(guest));
    const guestActive = await start(guest);
    const guestTutorial = await start(guest, 'tutorial-missing-key');
    const oldGuestCookie = guest.get('mt_guest')!;

    expect(await login(guest, 'alice')).toBe('ok');
    // 진행 중 충돌: 게스트 쪽이 더 최근이라 계정 쪽 진행 중 세션을 지운다(F를 남기지 않음)
    expect(await prisma.playSession.findUnique({ where: { id: accountActive } })).toBeNull();
    const user = await prisma.player.findUniqueOrThrow({ where: { googleSub: 'fake|alice' } });
    const sample = await prisma.playSession.findMany({
      where: { playerId: user.id, case: { slug: SAMPLE } },
      orderBy: { playNo: 'asc' },
      select: { id: true, playNo: true, status: true },
    });
    expect(sample.map((s) => [s.playNo, s.status])).toEqual([
      [1, 'SOLVED'],
      [2, 'ABANDONED'],
      [3, 'ACTIVE'],
    ]);
    expect(sample[2]!.id).toBe(guestActive);

    const list = await cases(guest);
    expect(list.find((c) => c.slug === SAMPLE)).toMatchObject({
      activeSessionId: guestActive,
      record: { bestGrade: 'S', bestPlayNo: 1, totalPlays: 2, solved: true },
    });
    expect(list.find((c) => c.slug === 'tutorial-missing-key')).toMatchObject({
      activeSessionId: guestTutorial,
      record: null,
    });
    // 이전된 게스트 쿠키는 더 이상 쓸 수 없다(새 게스트가 발급됨)
    const old = new Map([['mt_guest', oldGuestCookie]]);
    expect((await me(old)).kind).toBe('GUEST');
    expect(old.get('mt_guest')).not.toBe(oldGuestCookie);
  });

  it('기록 이전은 두 번 실행해도 결과가 같다(멱등)', async () => {
    const guest = await browser();
    await abandon(guest, await start(guest));
    const guestPlayer = await prisma.player.findFirstOrThrow({ where: { kind: 'GUEST' } });
    await login(guest, 'carol');
    const user = await prisma.player.findUniqueOrThrow({ where: { googleSub: 'fake|carol' } });
    const snapshot = async () => ({
      sessions: await prisma.playSession.findMany({
        where: { playerId: user.id },
        select: { id: true, playNo: true, status: true },
        orderBy: { id: 'asc' },
      }),
      records: await prisma.caseRecord.findMany({ where: { playerId: user.id } }),
    });
    const before = await snapshot();
    await prisma.$transaction((tx) => mergeGuestInto(tx, guestPlayer.id, user.id));
    expect(await snapshot()).toEqual(before);
  });

  it('로그아웃하면 세션이 지워지고 그 브라우저는 빈 새 게스트가 된다(기록은 계정에 남음)', async () => {
    const jar = await browser();
    await login(jar, 'dave');
    await start(jar);
    const res = await http().post('/auth/logout').set('Cookie', header(jar)).expect(204);
    absorb(jar, res);
    expect(jar.has('mt_session')).toBe(false);
    expect(await prisma.authSession.count()).toBe(0);
    expect((await me(jar)).kind).toBe('GUEST');
    expect((await cases(jar)).every((c) => c.activeSessionId === null)).toBe(true);
    // 다시 로그인하면 계정의 진행 중 세션이 그대로 있다
    await login(jar, 'dave');
    expect((await cases(jar)).find((c) => c.slug === SAMPLE)?.activeSessionId).not.toBeNull();
  });

  it('만료된 세션은 무시하고 게스트로 처리한다', async () => {
    const jar = await browser();
    await login(jar, 'erin');
    await prisma.authSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await me(jar)).kind).toBe('GUEST');
  });

  it('18세 확인 기록: 게스트는 401, 로그인 사용자는 처음 시각만 기록한다(D33)', async () => {
    const jar = await browser();
    await http().post('/me/age-confirmation').set('Cookie', header(jar)).expect(401);
    await login(jar, 'frank');
    await http().post('/me/age-confirmation').set('Cookie', header(jar)).expect(204);
    expect((await me(jar)).ageConfirmed).toBe(true);
    const first = (await prisma.player.findUniqueOrThrow({ where: { googleSub: 'fake|frank' } }))
      .ageConfirmedAt;
    await http().post('/me/age-confirmation').set('Cookie', header(jar)).expect(204);
    const again = (await prisma.player.findUniqueOrThrow({ where: { googleSub: 'fake|frank' } }))
      .ageConfirmedAt;
    expect(again).toEqual(first);
  });
});

describe('구글 설정이 없을 때 (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({
      authProvider: new GoogleAuthProvider({
        clientId: undefined,
        clientSecret: undefined,
        publicBaseUrl: 'http://localhost:3000',
      }),
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('로그인을 비활성으로 알리고, 시작하면 unavailable 로 돌려보낸다', async () => {
    const meRes = await request(app.getHttpServer()).get('/me').expect(200);
    expect(meRes.body.loginAvailable).toBe(false);
    const res = await request(app.getHttpServer()).get('/auth/google').expect(302);
    expect(res.headers['location']).toBe('http://localhost:3000/?login=unavailable');
  });
});
