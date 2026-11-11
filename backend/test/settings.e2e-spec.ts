import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { cookiePair, createTestApp, findSetCookie, resetDb } from './helpers.js';

// 실제 PostgreSQL 테스트 DB 필요.
describe('6단계 설정: 탐정 이름 (e2e, PRD D40)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  async function guest(): Promise<string> {
    const res = await http().get('/me').expect(200);
    return cookiePair(findSetCookie(res, 'mt_guest'));
  }
  const rename = (cookie: string, detectiveName: string) =>
    http().patch('/me').set('Cookie', cookie).send({ detectiveName });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('공백을 정리해 저장하고, 다시 불러와도 유지된다', async () => {
    const cookie = await guest();
    const res = await rename(cookie, '  명탐정   홈즈  ').expect(200);
    expect(res.body.detectiveName).toBe('명탐정 홈즈');
    expect((await http().get('/me').set('Cookie', cookie).expect(200)).body.detectiveName).toBe(
      '명탐정 홈즈',
    );
  });

  it.each([
    ['빈 이름', '   '],
    ['13자', '가'.repeat(13)],
    ['욕설', '씨 발 탐정'],
  ])('%s은(는) 거부한다', async (_name, value) => {
    const cookie = await guest();
    expect((await rename(cookie, value).expect(422)).body.code).toBe('NAME_NOT_ALLOWED');
  });

  it('12자까지 허용하고, 이름은 다른 플레이어에게 영향을 주지 않는다', async () => {
    const a = await guest();
    const b = await guest();
    await rename(a, '가'.repeat(12)).expect(200);
    expect((await http().get('/me').set('Cookie', b).expect(200)).body.detectiveName).toBe('탐정');
  });
});
