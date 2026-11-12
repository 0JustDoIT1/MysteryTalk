import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { readCaseDirs, type LoadedCase } from '../src/content/content-files.js';
import { syncCase } from '../src/content/content-sync.js';
import { AUTH_PROVIDER, FakeAuthProvider, type AuthProvider } from '../src/auth/auth-provider.js';
import { GRADER, type Grader } from '../src/grade/grader.types.js';
import { JUDGE, type Judge } from '../src/judge/judge.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const TEST_PUBLIC_BASE_URL = 'http://localhost:3000';

/** 테스트용 앱. judge·grader 를 넘기면 실제 AI 대신 그 판정기·채점기를 쓴다. */
export async function createTestApp(
  options: { judge?: Judge; grader?: Grader; authProvider?: AuthProvider } = {},
): Promise<{
  app: NestExpressApplication;
  prisma: PrismaService;
}> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.judge) builder = builder.overrideProvider(JUDGE).useValue(options.judge);
  if (options.grader) builder = builder.overrideProvider(GRADER).useValue(options.grader);
  // 로그인은 기본으로 가짜 제공자(실제 구글에 접속하지 않음)
  builder = builder
    .overrideProvider(AUTH_PROVIDER)
    .useValue(options.authProvider ?? new FakeAuthProvider(TEST_PUBLIC_BASE_URL));
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** 테스트마다 DB를 비운다. 테이블이 늘면 이 목록에 추가한다. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE usage_daily, budget_month, ai_call, submission, hint_view, case_record, question_log, play_session, case_version, mystery_case, player RESTART IDENTITY CASCADE',
  );
}

/** 공개 저장소의 튜토리얼 사건 데이터(실제 파일) */
export function tutorialCase(): LoadedCase {
  const loaded = readCaseDirs([resolve(import.meta.dirname, '../../content/public')]);
  const tutorial = loaded.find((c) => c.content.isTutorial);
  if (!tutorial) throw new Error('tutorial case not found');
  return tutorial;
}

export async function loadTutorial(prisma: PrismaService): Promise<LoadedCase> {
  const tutorial = tutorialCase();
  await syncCase(prisma, tutorial);
  return tutorial;
}

/** 공개 저장소의 샘플 사건 데이터(실제 파일) */
export function sampleCase(): LoadedCase {
  const loaded = readCaseDirs([resolve(import.meta.dirname, '../../content/public')]);
  const sample = loaded.find((c) => c.content.slug === 'sample-blackout-302');
  if (!sample) throw new Error('sample case not found');
  return sample;
}

export async function loadSample(prisma: PrismaService): Promise<LoadedCase> {
  const sample = sampleCase();
  await syncCase(prisma, sample);
  return sample;
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
