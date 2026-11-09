import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { hashGuestToken } from '../src/player/guest-token.js';
import { cookiePair, createTestApp, findSetCookie, resetDb } from './helpers.js';

// 실제 PostgreSQL 테스트 DB(DATABASE_URL_TEST)가 필요하다.
describe('1단계 기반 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health 는 DB 연결을 확인한다', async () => {
    await http().get('/health').expect(200).expect({ status: 'ok', db: 'ok' });
  });

  describe('게스트 발급과 재방문 식별 (SPEC §3.1)', () => {
    it('쿠키 없이 /me 를 부르면 게스트를 만들고 HttpOnly·SameSite=Lax·30일 쿠키를 준다', async () => {
      const res = await http().get('/me').expect(200);
      expect(res.body).toEqual({
        kind: 'GUEST',
        detectiveName: '탐정',
        ageConfirmed: false,
      });
      const setCookie = findSetCookie(res, 'mt_guest')!;
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Path=\//);
      expect(setCookie).toMatch(/Max-Age=2592000/);
      expect(await prisma.player.count()).toBe(1);
    });

    it('DB에는 토큰 원문이 아니라 해시만 저장한다', async () => {
      const res = await http().get('/me').expect(200);
      const token = cookiePair(findSetCookie(res, 'mt_guest')).split('=')[1]!;
      const player = await prisma.player.findFirstOrThrow();
      expect(player.guestTokenHash).toBe(hashGuestToken(token));
      expect(player.guestTokenHash).not.toContain(token);
    });

    it('같은 쿠키로 다시 오면 같은 게스트로 식별하고 새로 만들지 않는다', async () => {
      const first = await http().get('/me').expect(200);
      const cookie = cookiePair(findSetCookie(first, 'mt_guest'));
      const before = await prisma.player.findFirstOrThrow();

      const second = await http().get('/me').set('Cookie', cookie).expect(200);
      expect(second.body.kind).toBe('GUEST');
      expect(await prisma.player.count()).toBe(1);
      // 같은 토큰으로 쿠키 만료만 연장한다
      expect(cookiePair(findSetCookie(second, 'mt_guest'))).toBe(cookie);
      const after = await prisma.player.findFirstOrThrow();
      expect(after.id).toBe(before.id);
      expect(after.lastActiveAt.getTime()).toBeGreaterThanOrEqual(before.lastActiveAt.getTime());
    });

    it('형식은 맞지만 모르는 토큰이면 새 게스트를 발급한다', async () => {
      const forged = `mt_guest=${'A'.repeat(43)}`;
      const res = await http().get('/me').set('Cookie', forged).expect(200);
      expect(cookiePair(findSetCookie(res, 'mt_guest'))).not.toBe(forged);
      expect(await prisma.player.count()).toBe(1);
    });

    it('형식이 틀린 쿠키는 무시하고 새 게스트를 발급한다', async () => {
      const res = await http().get('/me').set('Cookie', 'mt_guest=<script>').expect(200);
      expect(findSetCookie(res, 'mt_guest')).toMatch(/^mt_guest=[A-Za-z0-9_-]{43};/);
    });

    it('30일 넘게 활동이 없던 게스트 쿠키는 새 게스트로 대체한다', async () => {
      const first = await http().get('/me').expect(200);
      const cookie = cookiePair(findSetCookie(first, 'mt_guest'));
      await prisma.player.updateMany({
        data: { lastActiveAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });
      const res = await http().get('/me').set('Cookie', cookie).expect(200);
      expect(cookiePair(findSetCookie(res, 'mt_guest'))).not.toBe(cookie);
      expect(await prisma.player.count()).toBe(2);
    });
  });

  it('없는 경로도 { code, message } 형식으로 응답한다', async () => {
    const res = await http().get('/no-such-route').expect(404);
    expect(res.body).toEqual({
      code: 'NOT_FOUND',
      message: expect.any(String),
    });
  });

  it('16KB를 넘는 요청 본문은 거부한다', async () => {
    const res = await http()
      .post('/me')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ x: 'a'.repeat(20_000) }));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('INVALID_INPUT');
  });
});
