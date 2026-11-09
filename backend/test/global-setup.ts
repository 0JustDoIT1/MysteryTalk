import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * e2e 테스트 전용 DB를 준비한다.
 * - DATABASE_URL_TEST 가 없거나 DB 이름이 `_test` 로 끝나지 않으면 실행을 거부한다(개발 DB 보호).
 * - DB가 없으면 만들고, 커밋된 마이그레이션을 적용한다(migrate deploy).
 */
export default async function setup(): Promise<void> {
  const raw = process.env['DATABASE_URL_TEST'];
  if (!raw)
    throw new Error('DATABASE_URL_TEST is required for e2e tests (see backend/.env.example)');
  const dbName = new URL(raw).pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Refusing to run e2e tests: database name "${dbName}" must end with "_test"`);
  }

  const adminUrl = new URL(raw);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
  });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS "exists"`;
    if (!rows[0]?.exists) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: raw },
    stdio: 'pipe',
  });
}
