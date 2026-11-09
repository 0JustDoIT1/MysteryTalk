import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export async function createTestApp(): Promise<{
  app: NestExpressApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** 테스트마다 DB를 비운다. 테이블이 늘면 이 목록에 추가한다. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE player RESTART IDENTITY CASCADE');
}

/** 응답의 Set-Cookie 에서 특정 쿠키의 원본 헤더 문자열을 찾는다. */
export function findSetCookie(res: Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((c) => c.startsWith(`${name}=`));
}

/** Set-Cookie 를 다음 요청의 Cookie 헤더 값(`name=value`)으로 바꾼다. */
export function cookiePair(setCookie: string | undefined): string {
  if (!setCookie) throw new Error('expected a Set-Cookie header');
  return setCookie.split(';')[0]!;
}
